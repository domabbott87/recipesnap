import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import * as cheerio from "cheerio";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertRecipeSchema, FREE_RECIPE_LIMIT } from "@shared/schema";
import { z } from "zod";

// Extend session type
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

/** Middleware: require authenticated session */
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  },
});

function getAnthropic(): Anthropic {
  return new Anthropic();
}

/** Call Claude with model fallback. Returns the text response. */
async function callClaude(messages: Anthropic.MessageParam[]): Promise<string> {
  const client = getAnthropic();
  const MODELS = ["claude-haiku-4-5", "claude-sonnet-4-5"];
  let lastError: any;
  for (const model of MODELS) {
    try {
      const response = await client.messages.create({ model, max_tokens: 2000, messages });
      return response.content[0].type === "text" ? response.content[0].text : "";
    } catch (err: any) {
      lastError = err;
      const msg = err?.message ?? "";
      if (!msg.includes("exhausted") && !msg.includes("overloaded")) throw err;
      console.warn(`Model ${model} exhausted, trying next...`);
    }
  }
  throw lastError ?? new Error("All models failed");
}

/** Extract recipe JSON from an HTML page. Returns parsed object or null. */
function extractJsonLd(html: string): any | null {
  const $ = cheerio.load(html);
  const scripts = $("script[type='application/ld+json']").toArray();
  for (const el of scripts) {
    try {
      const raw = $(el).html() ?? "";
      const data = JSON.parse(raw);
      // Handle array of objects or single object
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const type = item["@type"];
        const isRecipe = type === "Recipe" ||
          (Array.isArray(type) && type.includes("Recipe"));
        if (isRecipe) return item;
      }
      // Handle @graph
      if (data["@graph"]) {
        const recipe = data["@graph"].find((n: any) => {
          const t = n["@type"];
          return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"));
        });
        if (recipe) return recipe;
      }
    } catch {
      // skip malformed JSON-LD blocks
    }
  }
  return null;
}

/** Normalise a JSON-LD Recipe object into our schema shape */
function normaliseJsonLd(data: any) {
  const text = (v: any): string => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object" && v["@type"] === "HowToStep") return v.text ?? v.name ?? "";
    if (typeof v === "object") return v.text ?? v.name ?? String(v);
    return String(v);
  };
  const arr = (v: any): string[] => {
    if (!v) return [];
    const list = Array.isArray(v) ? v : [v];
    return list.map(text).filter(Boolean);
  };
  const dur = (iso: string | undefined): string | null => {
    if (!iso) return null;
    const m = iso.match(/(?:(\d+)H)?(?:(\d+)M)?/);
    if (!m) return null;
    const h = parseInt(m[1] ?? "0");
    const min = parseInt(m[2] ?? "0");
    if (h && min) return `${h} hr ${min} mins`;
    if (h) return `${h} hr`;
    if (min) return `${min} mins`;
    return null;
  };

  const ingredients = arr(data.recipeIngredient);
  const rawInstructions = data.recipeInstructions ?? [];
  const steps = arr(rawInstructions);
  const keywords = typeof data.keywords === "string"
    ? data.keywords.split(",").map((k: string) => k.trim().toLowerCase()).slice(0, 5)
    : arr(data.keywords).map((k: string) => k.toLowerCase()).slice(0, 5);
  const categories = arr(data.recipeCategory).map((k: string) => k.toLowerCase());
  const tags = [...new Set([...keywords, ...categories])].slice(0, 5);

  // Author can be string, object {name:...}, or array
  const authorRaw = Array.isArray(data.author) ? data.author[0] : data.author;
  const authorName = typeof authorRaw === "string"
    ? authorRaw
    : (authorRaw?.name ?? null);

  return {
    title: text(data.name) || "Untitled Recipe",
    source: authorName || null,
    serves: parseInt(data.recipeYield) || parseInt(arr(data.recipeYield)[0]) || null,
    prepTime: dur(data.prepTime),
    cookTime: dur(data.cookTime),
    ingredients,
    steps,
    tags,
    sourceText: "",
    imageDataUrl: null as null,
  };
}

/** Fetch a URL with timeout and a browser-like User-Agent */
async function fetchUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

/** Extract readable text from HTML, focusing on article/main content */
function extractReadableText(html: string): string {
  const $ = cheerio.load(html);
  // Remove noise
  $("script, style, nav, header, footer, aside, .ad, .ads, .advertisement, .social, .comments, .sidebar").remove();
  // Prefer the main content area
  const main = $("main, article, [class*='recipe'], [class*='content'], [id*='recipe'], [id*='content']").first();
  const text = (main.length ? main : $("body")).text();
  // Normalise whitespace and truncate
  return text.replace(/\s+/g, " ").trim().slice(0, 5000);
}

export function registerRoutes(httpServer: Server, app: Express) {
  // ─── Health check (used by Railway / Render / load balancers) ─────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // ─── Extract recipe from image ───────────────────────────────────────────
  app.post("/api/extract-recipe", upload.single("image"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }

    // Resize image to max 1024px on longest edge — reduces payload and speeds up AI processing
    let imageBuffer: Buffer;
    try {
      imageBuffer = await sharp(req.file.buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      imageBuffer = req.file.buffer; // fallback to original if resize fails
    }

    const base64 = imageBuffer.toString("base64");
    const mimeType = "image/jpeg" as const;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const prompt = `You are a recipe extraction assistant. Analyze this image and extract any recipe present.
Return ONLY valid JSON in this exact format, with no markdown or explanation:
{
  "title": "Recipe Title",
  "source": "Source or chef name if visible, else null",
  "serves": 4,
  "prepTime": "30 mins",
  "cookTime": "45 mins",
  "ingredients": ["1 cup flour", "2 eggs"],
  "steps": ["Preheat oven to 350F.", "Mix dry ingredients."],
  "tags": ["baking", "dessert"],
  "sourceText": "Raw extracted text from the image"
}
Rules:
- ingredients: each item is a single ingredient with quantity and unit
- steps: each step is a complete, actionable instruction
- tags: 2-5 relevant tags (cuisine, meal type, dietary, cooking method)
- If no recipe is visible, return {"error": "No recipe found in image"}`;

    // Try models in order until one works
    const MODELS = ["claude-haiku-4-5", "claude-sonnet-4-5"];

    try {
      const client = getAnthropic();
      let content = "";
      let lastError: any;

      for (const model of MODELS) {
        try {
          const response = await client.messages.create({
            model,
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mimeType, data: base64 },
                },
                { type: "text", text: prompt },
              ],
            }],
          });
          content = response.content[0].type === "text" ? response.content[0].text : "";
          break; // success, exit loop
        } catch (err: any) {
          lastError = err;
          const msg = err?.message ?? "";
          // Only retry on exhausted-model errors
          if (!msg.includes("exhausted") && !msg.includes("overloaded")) throw err;
          console.warn(`Model ${model} exhausted, trying next...`);
        }
      }

      if (!content) throw lastError ?? new Error("All models failed");
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Try to extract JSON from the response
        const match = content.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Could not parse AI response as JSON");
      }

      if (parsed.error) {
        return res.status(422).json({ error: parsed.error });
      }

      return res.json({
        title: parsed.title ?? "Untitled Recipe",
        source: parsed.source ?? null,
        serves: parsed.serves ?? 4,
        prepTime: parsed.prepTime ?? null,
        cookTime: parsed.cookTime ?? null,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        sourceText: parsed.sourceText ?? "",
        imageDataUrl: dataUrl,
      });
    } catch (err: any) {
      console.error("OpenAI extraction error:", err);
      return res.status(500).json({ error: err.message ?? "Extraction failed." });
    }
  });

  // ─── Extract recipe from URL ───────────────────────────────────────────────
  app.post("/api/extract-recipe-url", async (req, res) => {
    const { url } = req.body as { url?: string };
    if (!url?.trim()) return res.status(400).json({ error: "No URL provided." });

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("bad protocol");
    } catch {
      return res.status(400).json({ error: "Invalid URL. Please include https://" });
    }

    try {
      // 1. Fetch the page
      let html: string;
      try {
        html = await fetchUrl(parsedUrl.toString());
      } catch (err: any) {
        if (err.name === "AbortError") return res.status(504).json({ error: "Page took too long to load. Try a different URL." });
        const msg = err.message ?? "";
        if (msg.includes("402") || msg.includes("403") || msg.includes("401"))
          return res.status(502).json({ error: "This site blocks recipe imports. Try copying the URL from BBC Good Food, Taste.com.au, or another open site." });
        return res.status(502).json({ error: `Could not load the page (${msg}). Check the URL and try again.` });
      }

      // 2. Try JSON-LD structured data first (fast path)
      const jsonLd = extractJsonLd(html);
      if (jsonLd) {
        const recipe = normaliseJsonLd(jsonLd);
        if (recipe.ingredients.length > 0 && recipe.steps.length > 0) {
          return res.json(recipe);
        }
      }

      // 3. Fallback: extract readable text and send to Claude
      const pageText = extractReadableText(html);
      if (!pageText) return res.status(422).json({ error: "Could not read content from the page." });

      const prompt = `You are a recipe extraction assistant. The following is text extracted from a recipe webpage.
Extract the recipe and return ONLY valid JSON in this exact format, with no markdown or explanation:
{
  "title": "Recipe Title",
  "source": "Website or chef name",
  "serves": 4,
  "prepTime": "20 mins",
  "cookTime": "30 mins",
  "ingredients": ["1 cup flour", "2 eggs"],
  "steps": ["Preheat oven to 350F.", "Mix ingredients."],
  "tags": ["baking", "dessert"],
  "sourceText": ""
}
Rules:
- ingredients: each is a single ingredient with quantity
- steps: each is a complete actionable instruction
- tags: 2-5 relevant tags
- If no recipe is present, return {"error": "No recipe found"}

Page text:
${pageText}`;

      const content = await callClaude([{ role: "user", content: prompt }]);

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Could not parse AI response");
      }

      if (parsed.error) return res.status(422).json({ error: parsed.error });

      return res.json({
        title: parsed.title ?? "Untitled Recipe",
        source: parsed.source ?? new URL(url).hostname,
        serves: parsed.serves ?? null,
        prepTime: parsed.prepTime ?? null,
        cookTime: parsed.cookTime ?? null,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        sourceText: parsed.sourceText ?? "",
        imageDataUrl: null,
      });
    } catch (err: any) {
      console.error("URL extraction error:", err);
      return res.status(500).json({ error: err.message ?? "Extraction failed." });
    }
  });

  // ─── Extract recipe from plain text (captions, clipboard, etc.) ────────────
  app.post("/api/extract-recipe-text", async (req, res) => {
    const { text } = req.body as { text?: string };
    if (!text?.trim() || text.trim().length < 20)
      return res.status(400).json({ error: "Please paste more text (at least 20 characters)." });

    const prompt = `You are a recipe extraction assistant. Extract any recipe from the text below.
Return ONLY valid JSON in this exact format, with no markdown:
{
  "title": "Recipe Title",
  "source": "Author or account name if mentioned, else null",
  "serves": 4,
  "prepTime": "20 mins",
  "cookTime": "30 mins",
  "ingredients": ["2 cups flour", "1 tsp salt"],
  "steps": ["Mix dry ingredients.", "Add wet ingredients."],
  "tags": ["baking", "dessert"],
  "sourceText": ""
}
Rules:
- Parse ingredients and steps even if informally written (e.g. from a social media caption)
- ingredients: each is a single ingredient with quantity if given
- steps: each is a complete actionable instruction
- tags: 2-5 relevant tags
- If no recipe is present, return {"error": "No recipe found in the text"}

Text:
${text.trim().slice(0, 6000)}`;

    try {
      const content = await callClaude([{ role: "user", content: prompt }]);
      let parsed: any;
      try { parsed = JSON.parse(content); }
      catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
        else throw new Error("Could not parse AI response");
      }
      if (parsed.error) return res.status(422).json({ error: parsed.error });
      return res.json({
        title: parsed.title ?? "Untitled Recipe",
        source: parsed.source ?? null,
        serves: parsed.serves ?? null,
        prepTime: parsed.prepTime ?? null,
        cookTime: parsed.cookTime ?? null,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        sourceText: text.trim(),
        imageDataUrl: null,
      });
    } catch (err: any) {
      console.error("Text extraction error:", err);
      return res.status(500).json({ error: err.message ?? "Extraction failed." });
    }
  });

  // ─── Auth ───────────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
    if (!email?.trim() || !password) return res.status(400).json({ error: "Email and password required." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (storage.getUserByEmail(email.toLowerCase().trim()))
      return res.status(409).json({ error: "An account with that email already exists." });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = storage.createUser({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name?.trim() || null,
      plan: "free",
    });
    req.session.userId = user.id;
    return res.status(201).json({ id: user.id, email: user.email, name: user.name, plan: user.plan });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) return res.status(400).json({ error: "Email and password required." });
    const user = storage.getUserByEmail(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: "Invalid email or password." });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password." });
    req.session.userId = user.id;
    return res.json({ id: user.id, email: user.email, name: user.name, plan: user.plan });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
    const user = storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "Session invalid" });
    const recipeCount = storage.countRecipes(user.id);
    let preferences = {};
    try { preferences = JSON.parse(user.preferences ?? "{}"); } catch {}
    return res.json({ id: user.id, email: user.email, name: user.name, plan: user.plan, recipeCount, preferences });
  });

  app.patch("/api/auth/profile", requireAuth, (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ error: "Name is required." });
    const updated = storage.updateUserName(req.session.userId!, name.trim());
    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.json({ name: updated.name });
  });

  app.patch("/api/auth/preferences", requireAuth, (req, res) => {
    const prefs = req.body;
    if (!prefs || typeof prefs !== "object") return res.status(400).json({ error: "Invalid preferences" });
    const updated = storage.updateUserPreferences(req.session.userId!, JSON.stringify(prefs));
    if (!updated) return res.status(404).json({ error: "User not found" });
    let preferences = {};
    try { preferences = JSON.parse(updated.preferences ?? "{}"); } catch {}
    return res.json({ preferences });
  });

  // ─── Recipe CRUD (auth required) ───────────────────────────────────────────────
  app.get("/api/recipes", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    res.json(storage.getAllRecipes(userId));
  });

  app.get("/api/recipes/:id", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const recipe = storage.getRecipe(id, req.session.userId!);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });
    res.json(recipe);
  });

  app.post("/api/recipes", requireAuth, (req, res) => {
    const userId = req.session.userId!;
    const user = storage.getUserById(userId)!;
    // Enforce free-tier limit
    if (user.plan === "free" && storage.countRecipes(userId) >= FREE_RECIPE_LIMIT) {
      return res.status(403).json({
        error: "free_limit_reached",
        message: `Free plan is limited to ${FREE_RECIPE_LIMIT} recipes. Upgrade to Premium for unlimited storage.`,
      });
    }
    const parsed = insertRecipeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const data: any = {
      ...parsed.data,
      userId,
      ingredients: typeof parsed.data.ingredients === "string" ? parsed.data.ingredients : JSON.stringify(parsed.data.ingredients),
      steps: typeof parsed.data.steps === "string" ? parsed.data.steps : JSON.stringify(parsed.data.steps),
      tags: typeof parsed.data.tags === "string" ? parsed.data.tags : JSON.stringify(parsed.data.tags),
    };
    res.status(201).json(storage.createRecipe(data));
  });

  app.put("/api/recipes/:id", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const partial = insertRecipeSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: partial.error.message });
    const data: any = { ...partial.data };
    if (Array.isArray(data.ingredients)) data.ingredients = JSON.stringify(data.ingredients);
    if (Array.isArray(data.steps)) data.steps = JSON.stringify(data.steps);
    if (Array.isArray(data.tags)) data.tags = JSON.stringify(data.tags);
    const updated = storage.updateRecipe(id, req.session.userId!, data);
    if (!updated) return res.status(404).json({ error: "Recipe not found" });
    res.json(updated);
  });

  app.delete("/api/recipes/:id", requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    if (!storage.deleteRecipe(id, req.session.userId!)) return res.status(404).json({ error: "Recipe not found" });
    res.json({ success: true });
  });
}
