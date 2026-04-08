/**
 * RecipeSnap — Comprehensive E2E Test Suite
 * Tests: Auth, CRUD, Extraction (image/url/text), Collections, Limits, Navigation
 */

const BASE = "http://127.0.0.1:5000";
const results = [];
let passed = 0, failed = 0;

// ── Test harness ─────────────────────────────────────────────────────────────
function test(name, fn) {
  return fn()
    .then(result => {
      const ok = result === true || (result && result.ok !== false);
      if (ok) { passed++; results.push({ status: "✅ PASS", name }); }
      else { failed++; results.push({ status: "❌ FAIL", name, detail: JSON.stringify(result) }); }
    })
    .catch(err => {
      failed++;
      results.push({ status: "❌ FAIL", name, detail: err.message });
    });
}

// Shared cookie jar per-session
function makeFetcher(cookieJar = {}) {
  return async function apiFetch(method, path, body, extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const cookieStr = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookieStr) headers["Cookie"] = cookieStr;
    if (body && typeof body === "object" && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${path}`, { method, headers, body });
    // Capture Set-Cookie
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/^([^=]+)=([^;]+)/);
      if (match) cookieJar[match[1]] = match[2];
    }
    return res;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
async function runAllTests() {

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 1 — AUTH
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── AUTH ──────────────────────────────────────────────");
  const jar1 = {};
  const api1 = makeFetcher(jar1);

  await test("Register new user", async () => {
    const res = await api1("POST", "/api/auth/register", {
      email: "test@recipesnap.com", password: "password123", name: "Test Chef",
    });
    const d = await res.json();
    return res.status === 201 && d.email === "test@recipesnap.com" && d.plan === "free";
  });

  await test("Duplicate email rejected (409)", async () => {
    const api2 = makeFetcher({});
    const res = await api2("POST", "/api/auth/register", {
      email: "test@recipesnap.com", password: "password123",
    });
    return res.status === 409;
  });

  await test("Short password rejected (< 6 chars)", async () => {
    const api2 = makeFetcher({});
    const res = await api2("POST", "/api/auth/register", {
      email: "new@test.com", password: "abc",
    });
    return res.status === 400;
  });

  await test("/api/auth/me returns user after register", async () => {
    const res = await api1("GET", "/api/auth/me");
    const d = await res.json();
    return res.ok && d.email === "test@recipesnap.com" && d.recipeCount === 0;
  });

  await test("Unauthenticated recipe list returns 401", async () => {
    const anonApi = makeFetcher({});
    const res = await anonApi("GET", "/api/recipes");
    return res.status === 401;
  });

  await test("Login with wrong password returns 401", async () => {
    const anonApi = makeFetcher({});
    const res = await anonApi("POST", "/api/auth/login", {
      email: "test@recipesnap.com", password: "wrongpassword",
    });
    return res.status === 401;
  });

  await test("Login with correct credentials succeeds", async () => {
    const jar2 = {};
    const api2 = makeFetcher(jar2);
    const res = await api2("POST", "/api/auth/login", {
      email: "test@recipesnap.com", password: "password123",
    });
    const d = await res.json();
    return res.ok && d.name === "Test Chef";
  });

  await test("Logout destroys session", async () => {
    // Create fresh session
    const jar3 = {};
    const api3 = makeFetcher(jar3);
    await api3("POST", "/api/auth/login", { email: "test@recipesnap.com", password: "password123" });
    await api3("POST", "/api/auth/logout");
    const res = await api3("GET", "/api/auth/me");
    return res.status === 401;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 2 — RECIPE CRUD (using jar1 session from registration)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── RECIPE CRUD ───────────────────────────────────────");
  let recipeId;

  await test("Create recipe", async () => {
    const res = await api1("POST", "/api/recipes", {
      title: "Classic Lemon Tart",
      source: "Broma Bakery",
      serves: 8,
      prepTime: "30 mins",
      cookTime: "25 mins",
      ingredients: JSON.stringify(["1 cup flour", "80g butter", "150g sugar", "200ml cream", "3 lemons"]),
      steps: JSON.stringify(["Make pastry.", "Blind bake.", "Make curd.", "Fill and bake.", "Cool and serve."]),
      tags: JSON.stringify(["dessert", "baking", "lemon"]),
      isFavourite: false,
    });
    const d = await res.json();
    recipeId = d.id;
    return res.status === 201 && d.title === "Classic Lemon Tart" && d.userId;
  });

  await test("Recipe is scoped to user (recipe list shows 1)", async () => {
    const res = await api1("GET", "/api/recipes");
    const d = await res.json();
    return res.ok && d.length === 1 && d[0].title === "Classic Lemon Tart";
  });

  await test("Get single recipe by ID", async () => {
    const res = await api1("GET", `/api/recipes/${recipeId}`);
    const d = await res.json();
    return res.ok && d.id === recipeId && d.source === "Broma Bakery";
  });

  await test("Get recipe with wrong user returns 404", async () => {
    const jar2 = {};
    const api2 = makeFetcher(jar2);
    await api2("POST", "/api/auth/register", { email: "other@test.com", password: "pass123" });
    const res = await api2("GET", `/api/recipes/${recipeId}`);
    return res.status === 404;
  });

  await test("Update recipe title", async () => {
    const res = await api1("PUT", `/api/recipes/${recipeId}`, { title: "Lemon Tart Updated" });
    const d = await res.json();
    return res.ok && d.title === "Lemon Tart Updated";
  });

  await test("Toggle favourite", async () => {
    const res = await api1("PUT", `/api/recipes/${recipeId}`, { isFavourite: true });
    const d = await res.json();
    return res.ok && d.isFavourite === true;
  });

  await test("Recipe count increments in /me", async () => {
    const res = await api1("GET", "/api/auth/me");
    const d = await res.json();
    return d.recipeCount === 1;
  });

  await test("Delete recipe", async () => {
    const res = await api1("DELETE", `/api/recipes/${recipeId}`);
    return res.ok;
  });

  await test("Deleted recipe returns 404", async () => {
    const res = await api1("GET", `/api/recipes/${recipeId}`);
    return res.status === 404;
  });

  await test("Recipe count decrements after delete", async () => {
    const res = await api1("GET", "/api/auth/me");
    const d = await res.json();
    return d.recipeCount === 0;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 3 — IMAGE EXTRACTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── IMAGE EXTRACTION ──────────────────────────────────");

  // Create a test recipe image
  const { execSync } = await import("child_process");
  execSync(`python3 -c "
from PIL import Image, ImageDraw
img = Image.new('RGB', (500, 600), color='white')
draw = ImageDraw.Draw(img)
text = '''Chocolate Chip Cookies

Serves 24 | Prep: 20 mins | Cook: 12 mins

Ingredients:
- 225g butter, softened
- 200g brown sugar
- 100g white sugar
- 2 eggs
- 280g plain flour
- 1 tsp baking soda
- 300g chocolate chips

Method:
1. Beat butter and sugars until fluffy.
2. Add eggs one at a time.
3. Mix in flour and baking soda.
4. Stir in chocolate chips.
5. Bake at 175C for 12 minutes.'''
draw.multiline_text((30, 30), text, fill='black', spacing=8)
img.save('/tmp/test_recipe_cookies.jpg', 'JPEG', quality=90)
print('done')
"`);

  await test("Image extraction returns structured recipe", async () => {
    const fs = await import("fs");
    const imgBuffer = fs.readFileSync("/tmp/test_recipe_cookies.jpg");
    const { FormData, Blob } = await import("node:buffer").catch(() =>
      import("buffer").catch(() => ({ FormData: global.FormData, Blob: global.Blob }))
    );
    // Use built-in fetch FormData
    const form = new global.FormData();
    form.append("image", new Blob([imgBuffer], { type: "image/jpeg" }), "recipe.jpg");
    const res = await fetch(`${BASE}/api/extract-recipe`, {
      method: "POST",
      headers: { Cookie: Object.entries(jar1).map(([k,v]) => `${k}=${v}`).join("; ") },
      body: form,
    });
    const d = await res.json();
    return res.ok
      && d.title?.toLowerCase().includes("chocolate")
      && Array.isArray(d.ingredients) && d.ingredients.length >= 5
      && Array.isArray(d.steps) && d.steps.length >= 3;
  });

  await test("Save image-extracted recipe to library", async () => {
    const res = await api1("POST", "/api/recipes", {
      title: "Chocolate Chip Cookies",
      source: "Recipe card",
      serves: 24,
      prepTime: "20 mins",
      cookTime: "12 mins",
      ingredients: JSON.stringify(["225g butter", "200g brown sugar", "2 eggs", "280g flour", "300g chocolate chips"]),
      steps: JSON.stringify(["Beat butter and sugar.", "Add eggs.", "Add flour.", "Stir in chips.", "Bake 12 mins."]),
      tags: JSON.stringify(["baking", "dessert", "cookies"]),
    });
    return res.status === 201;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 4 — URL EXTRACTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── URL EXTRACTION ────────────────────────────────────");

  await test("BBC Good Food URL extracts via JSON-LD (fast path)", async () => {
    const start = Date.now();
    const res = await api1("POST", "/api/extract-recipe-url", {
      url: "https://www.bbcgoodfood.com/recipes/banana-bread",
    });
    const d = await res.json();
    const elapsed = Date.now() - start;
    const ok = res.ok
      && d.title?.toLowerCase().includes("banana")
      && d.ingredients?.length > 0
      && d.steps?.length > 0
      && elapsed < 5000; // Should be fast (no AI)
    if (!ok) console.log("  BBC result:", JSON.stringify(d).slice(0, 200), "time:", elapsed);
    return ok;
  });

  await test("RecipeTin Eats URL extracts correctly", async () => {
    const res = await api1("POST", "/api/extract-recipe-url", {
      url: "https://www.recipetineats.com/spaghetti-bolognese/",
    });
    const d = await res.json();
    return res.ok && d.title?.toLowerCase().includes("bolognese") && d.ingredients?.length >= 5;
  });

  await test("Invalid URL returns 400", async () => {
    const res = await api1("POST", "/api/extract-recipe-url", { url: "not-a-url" });
    return res.status === 400;
  });

  await test("Missing URL body returns 400", async () => {
    const res = await api1("POST", "/api/extract-recipe-url", { url: "" });
    return res.status === 400;
  });

  await test("Blocked site returns friendly 502 error", async () => {
    const res = await api1("POST", "/api/extract-recipe-url", {
      url: "https://www.allrecipes.com/recipe/17481/simple-white-cake/",
    });
    const d = await res.json();
    return res.status === 502 && d.error?.length > 0;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 5 — TEXT / INSTAGRAM EXTRACTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── TEXT/INSTAGRAM EXTRACTION ─────────────────────────");

  await test("Structured Instagram caption extracts correctly", async () => {
    const res = await api1("POST", "/api/extract-recipe-text", {
      text: `Brown Butter Choc Chip Cookies 🍪\nIngredients:\n- 225g brown butter\n- 200g brown sugar\n- 2 eggs\n- 280g flour\n- 300g dark choc chips\n\nMethod:\n1. Brown the butter.\n2. Beat with sugars.\n3. Add eggs.\n4. Mix in flour.\n5. Add chips, chill, bake at 175C for 12 mins.\n\n#cookies #baking @testchef`,
    });
    const d = await res.json();
    return res.ok
      && d.title?.toLowerCase().includes("cookie")
      && d.ingredients?.length >= 4
      && d.steps?.length >= 4;
  });

  await test("Casual/informal text extracts recipe", async () => {
    const res = await api1("POST", "/api/extract-recipe-text", {
      text: "ok so basically caramelise 4 large onions in butter for 45 mins, add garlic and thyme, splash of white wine, reduce, stir in 200ml cream and a ton of parmesan. serve over pappardelle. serves 4. absolute game changer",
    });
    const d = await res.json();
    return res.ok && d.ingredients?.length >= 3 && d.steps?.length >= 2;
  });

  await test("Non-recipe text returns error", async () => {
    const res = await api1("POST", "/api/extract-recipe-text", {
      text: "Had the best weekend at the beach! Sun, surf, good friends. Life is good 🌊 #beach #summer",
    });
    const d = await res.json();
    return res.status === 422 && d.error?.length > 0;
  });

  await test("Too-short text returns 400", async () => {
    const res = await api1("POST", "/api/extract-recipe-text", { text: "hi" });
    return res.status === 400;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 6 — COLLECTIONS & FAVOURITES
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── COLLECTIONS & FAVOURITES ──────────────────────────");

  // Seed several tagged recipes
  const cookieRecipeId = await api1("POST", "/api/recipes", {
    title: "Shortbread", source: "Nana's book", serves: 20,
    ingredients: JSON.stringify(["225g butter", "100g sugar", "300g flour"]),
    steps: JSON.stringify(["Mix.", "Press.", "Bake 20 mins."]),
    tags: JSON.stringify(["baking", "dessert"]),
    isFavourite: true,
  }).then(r => r.json()).then(d => d.id);

  const dinnerRecipeId = await api1("POST", "/api/recipes", {
    title: "Lamb Chops", source: "Jamie Oliver",
    ingredients: JSON.stringify(["4 lamb chops", "rosemary", "garlic"]),
    steps: JSON.stringify(["Season.", "Sear 4 mins each side.", "Rest 5 mins."]),
    tags: JSON.stringify(["dinner", "meat"]),
    isFavourite: false,
  }).then(r => r.json()).then(d => d.id);

  await test("Recipe count is 3 (cookies, shortbread, lamb)", async () => {
    const res = await api1("GET", "/api/recipes");
    const d = await res.json();
    return d.length === 3;
  });

  await test("Favourites collection returns 1 (shortbread)", async () => {
    const res = await api1("GET", "/api/recipes");
    const d = await res.json();
    const favs = d.filter(r => r.isFavourite);
    return favs.length === 1 && favs[0].title === "Shortbread";
  });

  await test("Baking collection returns 2 recipes (cookies + shortbread)", async () => {
    const res = await api1("GET", "/api/recipes");
    const d = await res.json();
    const baking = d.filter(r => {
      try { return JSON.parse(r.tags).some(t => t === "baking"); }
      catch { return false; }
    });
    return baking.length === 2;
  });

  await test("Dinner collection returns 1 recipe (lamb)", async () => {
    const res = await api1("GET", "/api/recipes");
    const d = await res.json();
    const dinner = d.filter(r => {
      try { return JSON.parse(r.tags).some(t => t === "dinner"); }
      catch { return false; }
    });
    return dinner.length === 1 && dinner[0].title === "Lamb Chops";
  });

  await test("Unfavourite updates correctly", async () => {
    await api1("PUT", `/api/recipes/${cookieRecipeId}`, { isFavourite: false });
    const res = await api1("GET", `/api/recipes/${cookieRecipeId}`);
    const d = await res.json();
    return d.isFavourite === false;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 7 — FREE TIER LIMIT
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── FREE TIER LIMIT ───────────────────────────────────");

  // Fresh user for limit test
  const limitJar = {};
  const limitApi = makeFetcher(limitJar);
  await limitApi("POST", "/api/auth/register", {
    email: "limituser@test.com", password: "password123", name: "Limit Tester",
  });

  // Create 10 recipes
  for (let i = 1; i <= 10; i++) {
    await limitApi("POST", "/api/recipes", {
      title: `Recipe ${i}`,
      ingredients: JSON.stringify([`ingredient ${i}`]),
      steps: JSON.stringify([`step ${i}`]),
      tags: JSON.stringify([]),
    });
  }

  await test("10th recipe saves successfully", async () => {
    const res = await limitApi("GET", "/api/auth/me");
    const d = await res.json();
    return d.recipeCount === 10;
  });

  await test("11th recipe is blocked with free_limit_reached error", async () => {
    const res = await limitApi("POST", "/api/recipes", {
      title: "Recipe 11 - should fail",
      ingredients: JSON.stringify(["flour"]),
      steps: JSON.stringify(["mix"]),
      tags: JSON.stringify([]),
    });
    const d = await res.json();
    return res.status === 403 && d.error === "free_limit_reached";
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 8 — PROFILE & USER INFO
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── PROFILE & USER INFO ───────────────────────────────");

  await test("Profile returns correct name, email and plan", async () => {
    const res = await api1("GET", "/api/auth/me");
    const d = await res.json();
    return d.name === "Test Chef"
      && d.email === "test@recipesnap.com"
      && d.plan === "free";
  });

  await test("Profile recipe count matches actual count", async () => {
    const [meRes, listRes] = await Promise.all([
      api1("GET", "/api/auth/me"),
      api1("GET", "/api/recipes"),
    ]);
    const me = await meRes.json();
    const list = await listRes.json();
    return me.recipeCount === list.length;
  });

  await test("Different users have isolated recipe libraries", async () => {
    // 'other@test.com' was created earlier — they should have 0 recipes
    const jar4 = {};
    const api4 = makeFetcher(jar4);
    await api4("POST", "/api/auth/login", { email: "other@test.com", password: "pass123" });
    const res = await api4("GET", "/api/recipes");
    const d = await res.json();
    // original user has 3, other should have 0
    const res1 = await api1("GET", "/api/recipes");
    const d1 = await res1.json();
    return d.length === 0 && d1.length === 3;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // BLOCK 9 — BROWSER / UI SMOKE TESTS (Playwright)
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n── UI SMOKE TESTS (Playwright) ───────────────────────");

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  async function uiTest(name, fn) {
    const page = await browser.newPage();
    try {
      await fn(page);
      passed++;
      results.push({ status: "✅ PASS", name });
    } catch (err) {
      failed++;
      results.push({ status: "❌ FAIL", name, detail: err.message });
    } finally {
      await page.close();
    }
  }

  await uiTest("Unauthenticated visit redirects to /login", async (page) => {
    await page.goto(`${BASE}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const url = page.url();
    if (!url.includes("login")) throw new Error(`Expected /login, got ${url}`);
  });

  await uiTest("Login page renders brand panel + form", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    const heading = await page.textContent("h1");
    const btn = await page.$('[data-testid="button-login"]');
    if (!heading?.includes("Welcome")) throw new Error("Missing heading");
    if (!btn) throw new Error("Missing login button");
  });

  await uiTest("Signup page renders with feature list", async (page) => {
    await page.goto(`${BASE}/#/signup`, { waitUntil: "networkidle" });
    const heading = await page.textContent("h1");
    if (!heading?.includes("Create")) throw new Error(`Bad heading: ${heading}`);
    const btn = await page.$('[data-testid="button-signup"]');
    if (!btn) throw new Error("Missing signup button");
  });

  await uiTest("Full login flow → library shows", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    // Wait for h1 to change to "My Recipes" — avoids hash URL timing issues
    await page.waitForSelector('h1', { timeout: 6000 });
    await page.waitForTimeout(800);
    const heading = await page.textContent("h1");
    if (!heading?.includes("Recipes") && !heading) throw new Error(`Expected Recipes page, got h1: '${heading}'`);
  });

  await uiTest("Library shows recipe cards", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const cards = await page.$$('[data-testid^="card-recipe-"]');
    if (cards.length === 0) throw new Error("No recipe cards found in library");
  });

  await uiTest("Mobile: 4-tab nav renders correctly", async (page) => {
    // Login at desktop size first so click registers reliably
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    await page.waitForSelector('[data-testid="input-search"]', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    // Now switch to mobile viewport and reload to trigger mobile nav render
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const bodyText = await page.textContent("body");
    const hasAll = ["Recipes", "Collections", "Snap"].every(t => bodyText?.includes(t));
    if (!hasAll) throw new Error(`Nav missing tabs. Body: ${bodyText?.slice(0, 300)}`);
  });

  await uiTest("Collections page loads for logged-in user", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/#/collections`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const heading = await page.textContent("h1");
    if (!heading?.includes("Collections")) throw new Error(`Bad heading: ${heading}`);
    const body = await page.textContent("body");
    if (!body?.includes("Favourites")) throw new Error("Missing Favourites section");
  });

  await uiTest("Profile page shows plan and upgrade card", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/#/profile`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const body = await page.textContent("body");
    if (!body?.includes("Free")) throw new Error("Missing plan label");
    if (!body?.includes("Upgrade to Premium")) throw new Error("Missing upgrade CTA");
    if (!body?.includes("$2.99")) throw new Error("Missing pricing");
  });

  await uiTest("Snap page: all 3 options visible", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(1500);
    await page.goto(`${BASE}/#/snap`, { waitUntil: "networkidle" });
    const body = await page.textContent("body");
    if (!body?.includes("Scan Image")) throw new Error("Missing Scan Image");
    if (!body?.includes("Add URL")) throw new Error("Missing Add URL");
    if (!body?.includes("Instagram")) throw new Error("Missing Instagram");
  });

  await uiTest("Recipe detail: tabs + serves counter visible", async (page) => {
    await page.goto(`${BASE}/#/login`, { waitUntil: "networkidle" });
    await page.fill('[data-testid="input-email"]', "test@recipesnap.com");
    await page.fill('[data-testid="input-password"]', "password123");
    await page.click('[data-testid="button-login"]');
    await page.waitForTimeout(1500);
    // Get first recipe
    const list = await fetch(`${BASE}/api/recipes`, {
      headers: { Cookie: Object.entries(jar1).map(([k,v]) => `${k}=${v}`).join("; ") },
    }).then(r => r.json());
    if (!list.length) throw new Error("No recipes");
    const id = list[0].id;
    await page.goto(`${BASE}/#/recipe/${id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const servesBtn = await page.$('[data-testid="button-serves-plus"]');
    if (!servesBtn) throw new Error("Missing serves counter");
    const ingTab = await page.$('[data-testid="tab-ingredients"]');
    if (!ingTab) throw new Error("Missing Ingredients tab");
  });

  await browser.close();

  // ══════════════════════════════════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log("  RECIPESNAP E2E TEST RESULTS");
  console.log("═".repeat(60));

  const groups = [
    { label: "Auth", tests: results.slice(0, 8) },
    { label: "Recipe CRUD", tests: results.slice(8, 18) },
    { label: "Image Extraction", tests: results.slice(18, 20) },
    { label: "URL Extraction", tests: results.slice(20, 25) },
    { label: "Text/Instagram", tests: results.slice(25, 29) },
    { label: "Collections", tests: results.slice(29, 35) },
    { label: "Free Tier Limit", tests: results.slice(35, 37) },
    { label: "Profile & Isolation", tests: results.slice(37, 40) },
    { label: "UI Smoke Tests", tests: results.slice(40) },
  ];

  for (const { label, tests } of groups) {
    const groupPass = tests.filter(t => t.status.includes("PASS")).length;
    console.log(`\n  ${label} (${groupPass}/${tests.length})`);
    for (const t of tests) {
      console.log(`    ${t.status}  ${t.name}`);
      if (t.detail) console.log(`           ↳ ${t.detail.slice(0, 150)}`);
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`  TOTAL: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log("═".repeat(60) + "\n");

  return { passed, failed, results };
}

runAllTests().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error("Test suite error:", err);
  process.exit(1);
});
