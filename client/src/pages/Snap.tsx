import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Link as LinkIcon, X, Loader2, ArrowRight,
  AlertCircle, Upload, Image, CheckCircle2, ClipboardPaste,
  BookOpen,
} from "lucide-react";
import { SiInstagram } from "react-icons/si";
import { NoodleBowl, Tomato, Carrot } from "@/components/Illustrations";
import { API_BASE } from "@/lib/queryClient";

interface ExtractedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  sourceText: string;
  imageDataUrl: string | null;
  source?: string | null;
  serves?: number | null;
  prepTime?: string | null;
  cookTime?: string | null;
}

export const draftStore = {
  draft: null as ExtractedRecipe | null,
  set(d: ExtractedRecipe) { this.draft = d; },
  get() { return this.draft; },
  clear() { this.draft = null; },
};

type Mode = "idle" | "image" | "url" | "instagram";
type InstaTab = "caption" | "guide";

export default function Snap() {
  const [mode, setMode] = useState<Mode>("idle");
  const [instaTab, setInstaTab] = useState<InstaTab>("caption");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [captionText, setCaptionText] = useState("");

  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedRecipe | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ── helpers ────────────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setFile(f);
    setError(null);
    setExtracted(null);
    setMode("image");
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleExtract = async (endpoint: string, body: BodyInit, isJson = false) => {
    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: isJson ? { "Content-Type": "application/json" } : {},
        body,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Extraction failed."); return; }
      setExtracted(data as ExtractedRecipe);
    } catch (err: any) {
      setError(err.message ?? "Network error.");
    } finally {
      setIsExtracting(false);
    }
  };

  const extractFromImage = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    handleExtract("/api/extract-recipe", formData);
  };

  const extractFromUrl = () => {
    if (!urlInput.trim()) return;
    handleExtract("/api/extract-recipe-url", JSON.stringify({ url: urlInput.trim() }), true);
  };

  const extractFromCaption = () => {
    if (!captionText.trim()) return;
    handleExtract("/api/extract-recipe-text", JSON.stringify({ text: captionText.trim() }), true);
  };

  const handleUseRecipe = () => {
    if (!extracted) return;
    draftStore.set(extracted);
    navigate("/recipe/new");
  };

  const reset = () => {
    setFile(null); setPreview(null); setExtracted(null);
    setError(null); setMode("idle"); setUrlInput(""); setCaptionText("");
  };

  const switchMode = (m: Mode) => {
    setError(null);
    setMode(prev => prev === m ? "idle" : m);
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20 sm:pb-8">

        {/* Yellow brand header */}
        <div className="rounded-2xl bg-accent p-5 mb-6 relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="font-bold text-2xl text-foreground">Snap a Recipe</h1>
            <p className="text-sm font-medium text-foreground/70 mt-1">
              From all recipe sources: web, print, handwritten and Instagram
            </p>
          </div>
          <div className="absolute right-2 bottom-0 flex items-end gap-2 opacity-25 pointer-events-none">
            <NoodleBowl stroke="#000" size={64} />
            <Tomato stroke="#000" size={48} />
            <Carrot stroke="#000" size={56} />
          </div>
        </div>

        {!extracted ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">

              {/* ── Scan Image ───────────────────────────────────────────── */}
              <OptionRow
                icon={<Camera size={18} />}
                label="Scan Image"
                subtitle="Photo of a cookbook, recipe card or handwritten note"
                active={mode === "image"}
                onToggle={() => {
                  if (mode !== "image") {
                    setError(null);
                    setMode("image");
                    setTimeout(() => fileInputRef.current?.click(), 50);
                  }
                }}
                onClose={reset}
              >
                {mode === "image" && (
                  <div
                    onDrop={onDrop}
                    onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    className={`px-4 pb-4 space-y-3 ${isDragOver ? "opacity-60" : ""}`}
                  >
                    {preview ? (
                      <>
                        <div className="relative">
                          <img src={preview} alt="Preview" data-testid="img-preview"
                            className="w-full max-h-60 rounded-xl object-contain bg-muted" />
                          <button onClick={e => { e.stopPropagation(); reset(); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-card/90 border border-border text-muted-foreground hover:text-destructive">
                            <X size={13} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                            className="flex-1 rounded-full gap-1.5">
                            <Camera size={13} /> Change
                          </Button>
                          <Button size="sm" onClick={extractFromImage} disabled={isExtracting}
                            data-testid="button-extract"
                            className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-white gap-1.5">
                            {isExtracting ? <><Loader2 size={13} className="animate-spin" />Extracting…</> : <><ArrowRight size={13} />Extract</>}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                        <Upload size={20} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Drop a photo or click to browse</p>
                      </div>
                    )}
                  </div>
                )}
              </OptionRow>

              {/* ── Add URL ───────────────────────────────────────────────── */}
              <OptionRow
                icon={<LinkIcon size={18} />}
                label="Add URL"
                subtitle="Paste a link from any recipe website"
                active={mode === "url"}
                onToggle={() => switchMode("url")}
                onClose={reset}
              >
                {mode === "url" && (
                  <div className="px-4 pb-4 space-y-2">
                    <Input autoFocus value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) extractFromUrl(); }}
                      placeholder="https://www.bbcgoodfood.com/recipes/..."
                      className="rounded-xl bg-muted border-0 focus-visible:ring-primary/40 text-sm"
                      data-testid="input-url" />
                    <Button onClick={extractFromUrl} disabled={isExtracting || !urlInput.trim()}
                      data-testid="button-extract-url"
                      className="w-full rounded-full bg-primary hover:bg-primary/90 text-white gap-2">
                      {isExtracting ? <><Loader2 size={14} className="animate-spin" />Extracting…</> : <><ArrowRight size={14} />Extract from URL</>}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground pt-1">
                      Works with BBC Good Food, RecipeTin Eats, Taste.com.au and most recipe sites
                    </p>
                  </div>
                )}
              </OptionRow>

              {/* ── Instagram ─────────────────────────────────────────────── */}
              <OptionRow
                icon={<SiInstagram size={18} />}
                label="Instagram"
                subtitle="Import from an Instagram recipe post"
                active={mode === "instagram"}
                onToggle={() => switchMode("instagram")}
                onClose={reset}
                accent
              >
                {mode === "instagram" && (
                  <div className="px-4 pb-4">
                    {/* Tabs */}
                    <div className="flex gap-0 bg-muted rounded-xl p-0.5 mb-4">
                      {(["caption", "guide"] as InstaTab[]).map(tab => (
                        <button key={tab} onClick={() => setInstaTab(tab)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-[10px] transition-colors ${
                            instaTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}>
                          {tab === "caption" ? "Paste Caption" : "Screenshot Guide"}
                        </button>
                      ))}
                    </div>

                    {/* Tab: Paste Caption */}
                    {instaTab === "caption" && (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/60 text-xs text-muted-foreground">
                          <ClipboardPaste size={14} className="text-primary mt-0.5 shrink-0" />
                          <span>Open the Instagram post → tap <strong className="text-foreground">···</strong> → <strong className="text-foreground">Copy</strong>, or long-press the caption to select and copy it</span>
                        </div>
                        <Textarea
                          autoFocus={instaTab === "caption"}
                          value={captionText}
                          onChange={e => setCaptionText(e.target.value)}
                          placeholder={"Paste the recipe caption here…\n\nExample:\nBrown Butter Choc Chip Cookies 🍪\n\nIngredients:\n- 225g brown butter\n- 200g brown sugar…"}
                          rows={8}
                          className="rounded-xl bg-muted border-0 focus-visible:ring-primary/40 text-sm resize-none"
                          data-testid="input-caption"
                        />
                        <Button onClick={extractFromCaption} disabled={isExtracting || captionText.trim().length < 20}
                          data-testid="button-extract-caption"
                          className="w-full rounded-full bg-primary hover:bg-primary/90 text-white gap-2">
                          {isExtracting
                            ? <><Loader2 size={14} className="animate-spin" />Extracting…</>
                            : <><SiInstagram size={13} />Extract Recipe</>}
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                          Works with any post where the recipe is written in the caption
                        </p>
                      </div>
                    )}

                    {/* Tab: Screenshot Guide */}
                    {instaTab === "guide" && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          For Reels, stories, or posts where the recipe is shown visually — screenshot the post and upload it with Scan Image.
                        </p>
                        <div className="space-y-2">
                          {[
                            { step: "1", text: "Open the Instagram post or Reel" },
                            { step: "2", text: "Pause on the frame showing ingredients or steps" },
                            { step: "3", text: "Take a screenshot (press Volume Up + Power)" },
                            { step: "4", text: "Come back here and use Scan Image to upload it" },
                          ].map(({ step, text }) => (
                            <div key={step} className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {step}
                              </div>
                              <p className="text-sm text-foreground">{text}</p>
                            </div>
                          ))}
                        </div>
                        <Button variant="outline" onClick={() => { setMode("image"); setTimeout(() => fileInputRef.current?.click(), 50); }}
                          className="w-full rounded-full gap-2 mt-1">
                          <Camera size={14} />
                          Open Scan Image
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </OptionRow>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="sr-only"
              data-testid="input-file"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/8 border border-destructive/20">
                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-destructive">Extraction failed</p>
                  <p className="text-sm text-destructive/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Extraction result ──────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-primary/20">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <CheckCircle2 size={13} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-primary">Recipe extracted!</p>
                <p className="text-xs text-muted-foreground">Review and edit before saving.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {extracted.imageDataUrl && (
                <img src={extracted.imageDataUrl} alt="Source" className="w-full max-h-40 object-cover" />
              )}
              <div className="p-4">
                <h2 className="font-bold text-xl text-primary mb-1">{extracted.title}</h2>
                {extracted.source && <p className="text-xs text-muted-foreground mb-2">{extracted.source}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {extracted.serves && <span className="badge-blue">{extracted.serves} serves</span>}
                  {extracted.prepTime && <span className="badge-blue">Prep: {extracted.prepTime}</span>}
                  {extracted.cookTime && <span className="badge-blue">Cook: {extracted.cookTime}</span>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Ingredients ({extracted.ingredients.length})
                    </p>
                    <ul className="space-y-1">
                      {extracted.ingredients.slice(0, 6).map((item, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-primary font-bold">·</span>{item}
                        </li>
                      ))}
                      {extracted.ingredients.length > 6 && (
                        <li className="text-xs text-muted-foreground">+{extracted.ingredients.length - 6} more…</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Steps ({extracted.steps.length})
                    </p>
                    <ol className="space-y-1">
                      {extracted.steps.slice(0, 4).map((step, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                          <span className="line-clamp-2">{step}</span>
                        </li>
                      ))}
                      {extracted.steps.length > 4 && (
                        <li className="text-xs text-muted-foreground">+{extracted.steps.length - 4} more…</li>
                      )}
                    </ol>
                  </div>
                </div>
                {extracted.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {extracted.tags.map(t => <span key={t} className="badge-blue">{t}</span>)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1 rounded-full">Try another</Button>
              <Button onClick={handleUseRecipe} data-testid="button-use-recipe"
                className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-white gap-2">
                Edit & Save <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Reusable option row ────────────────────────────────────────────────────
function OptionRow({
  icon, label, subtitle, active, onToggle, onClose, accent, children,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  active: boolean;
  onToggle: () => void;
  onClose: () => void;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div
        onClick={active ? undefined : onToggle}
        className={`p-4 flex items-center gap-4 transition-colors ${!active ? "cursor-pointer hover:bg-muted/40" : ""}`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
          active
            ? accent ? "bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white" : "bg-primary text-white"
            : accent ? "bg-gradient-to-br from-[#833ab4]/15 via-[#fd1d1d]/15 to-[#fcb045]/15 text-[#c13584]" : "bg-primary/10 text-primary"
        }`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
        {active && (
          <button onClick={e => { e.stopPropagation(); onClose(); }}
            className="p-1 rounded-full text-muted-foreground hover:text-destructive shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
