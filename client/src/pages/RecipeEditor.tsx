import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe } from "@shared/schema";
import { draftStore } from "./Snap";
import { Plus, Trash2, Save, ArrowLeft, GripVertical, Tag, X } from "lucide-react";

function parse<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}

interface FormState {
  title: string;
  source: string;
  serves: number;
  prepTime: string;
  cookTime: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  imageDataUrl: string;
  sourceText: string;
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(tag => (
          <span key={tag} className="badge-blue gap-1 pr-1.5">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter(t => t !== tag))}
              className="hover:text-destructive transition-colors ml-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add tag and press Enter (e.g. dinner, baking)"
          className="text-sm rounded-full bg-muted border-0 focus-visible:ring-primary/40"
          data-testid="input-tag" />
        <Button type="button" variant="outline" size="sm" onClick={add}
          data-testid="button-add-tag" className="rounded-full">
          <Tag size={13} />
        </Button>
      </div>
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, numbered, addLabel }: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  numbered?: boolean;
  addLabel: string;
}) {
  const update = (i: number, v: string) => { const n = [...items]; n[i] = v; onChange(n); };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start group">
          <div className="flex items-center gap-1 pt-2.5 shrink-0">
            <GripVertical size={13} className="text-muted-foreground opacity-30" />
            {numbered && (
              <span className="text-xs font-bold text-primary/60 w-4 text-right">{i + 1}.</span>
            )}
          </div>
          {numbered ? (
            <Textarea value={item} onChange={e => update(i, e.target.value)}
              placeholder={`${placeholder} ${i + 1}`} rows={2}
              className="flex-1 text-sm resize-none rounded-xl bg-muted border-0 focus-visible:ring-primary/40"
              data-testid={`input-step-${i}`} />
          ) : (
            <Input value={item} onChange={e => update(i, e.target.value)}
              placeholder={placeholder}
              className="flex-1 text-sm rounded-full bg-muted border-0 focus-visible:ring-primary/40"
              data-testid={`input-ingredient-${i}`} />
          )}
          <button type="button" onClick={() => remove(i)}
            data-testid={`button-remove-item-${i}`}
            className="p-2 mt-0.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 size={12} />
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...items, ""])}
        className="text-primary hover:bg-secondary gap-1.5 text-xs rounded-full">
        <Plus size={12} />{addLabel}
      </Button>
    </div>
  );
}

export default function RecipeEditor() {
  const params = useParams<{ id?: string }>();
  const isNew = !params.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: existing } = useQuery<Recipe>({
    queryKey: ["/api/recipes", params.id],
    enabled: !isNew && !!params.id,
  });

  const [form, setForm] = useState<FormState>({
    title: "", source: "", serves: 4, prepTime: "", cookTime: "",
    ingredients: [""], steps: [""], tags: [], imageDataUrl: "", sourceText: "",
  });

  useEffect(() => {
    if (!isNew && existing) {
      setForm({
        title: existing.title,
        source: existing.source ?? "",
        serves: existing.serves ?? 4,
        prepTime: existing.prepTime ?? "",
        cookTime: existing.cookTime ?? "",
        ingredients: parse<string[]>(existing.ingredients, [""]),
        steps: parse<string[]>(existing.steps, [""]),
        tags: parse<string[]>(existing.tags, []),
        imageDataUrl: existing.imageDataUrl ?? "",
        sourceText: existing.sourceText ?? "",
      });
    } else if (isNew) {
      const draft = draftStore.get();
      if (draft) {
        setForm({
          title: draft.title, source: "", serves: 4, prepTime: "", cookTime: "",
          ingredients: draft.ingredients.length ? draft.ingredients : [""],
          steps: draft.steps.length ? draft.steps : [""],
          tags: draft.tags, imageDataUrl: draft.imageDataUrl ?? "", sourceText: draft.sourceText ?? "",
        });
        draftStore.clear();
      }
    }
  }, [existing, isNew]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/recipes", data),
    onSuccess: async res => {
      const recipe = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Recipe saved!" });
      navigate(`/recipe/${recipe.id}`);
    },
    onError: (err: any) => {
      const msg = err?.message ?? "";
      if (msg.includes("free_limit_reached") || msg.includes("403")) {
        toast({ title: "Upgrade needed", description: "You've reached the free plan limit. Upgrade to Premium for unlimited recipes.", variant: "destructive" });
      } else {
        toast({ title: "Failed to save", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/recipes/${params.id}`, data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", params.id] });
      toast({ title: "Recipe updated!" });
      navigate(`/recipe/${params.id}`);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: "Please add a recipe title", variant: "destructive" }); return; }
    const data = {
      title: form.title.trim(),
      source: form.source || null,
      serves: form.serves,
      prepTime: form.prepTime || null,
      cookTime: form.cookTime || null,
      ingredients: JSON.stringify(form.ingredients.filter(i => i.trim())),
      steps: JSON.stringify(form.steps.filter(s => s.trim())),
      tags: JSON.stringify(form.tags),
      imageDataUrl: form.imageDataUrl || null,
      sourceText: form.sourceText || null,
    };
    if (isNew) createMutation.mutate(data);
    else updateMutation.mutate(data);
  };

  const set = (k: keyof FormState, v: any) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20 sm:pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(isNew ? "/" : `/recipe/${params.id}`)}
            data-testid="button-back"
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-bold text-xl text-foreground">{isNew ? "New Recipe" : "Edit Recipe"}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.imageDataUrl && (
            <div className="relative rounded-2xl overflow-hidden">
              <img src={form.imageDataUrl} alt="Source" className="w-full max-h-44 object-cover" />
              <button type="button" onClick={() => set("imageDataUrl", "")}
                data-testid="button-remove-image-editor"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-card/80 border border-border text-muted-foreground hover:text-destructive">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Title */}
          <Field label="Recipe Title">
            <Input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="e.g. Classic Lemon Tart"
              className="text-base font-bold rounded-xl bg-muted border-0 focus-visible:ring-primary/40 h-12"
              data-testid="input-title" />
          </Field>

          {/* Source + Serves */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source / Chef">
              <Input value={form.source} onChange={e => set("source", e.target.value)}
                placeholder="e.g. Broma Bakery"
                className="rounded-xl bg-muted border-0 focus-visible:ring-primary/40"
                data-testid="input-source" />
            </Field>
            <Field label="Serves">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => set("serves", Math.max(1, form.serves - 1))}
                  className="serves-btn">−</button>
                <span className="font-bold text-lg w-8 text-center">{form.serves}</span>
                <button type="button" onClick={() => set("serves", form.serves + 1)}
                  className="serves-btn">+</button>
              </div>
            </Field>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prep Time">
              <Input value={form.prepTime} onChange={e => set("prepTime", e.target.value)}
                placeholder="e.g. 30 mins"
                className="rounded-xl bg-muted border-0 focus-visible:ring-primary/40" />
            </Field>
            <Field label="Cook Time">
              <Input value={form.cookTime} onChange={e => set("cookTime", e.target.value)}
                placeholder="e.g. 45 mins"
                className="rounded-xl bg-muted border-0 focus-visible:ring-primary/40" />
            </Field>
          </div>

          {/* Ingredients */}
          <Field label="Ingredients" count={form.ingredients.filter(Boolean).length}>
            <ListEditor items={form.ingredients} onChange={v => set("ingredients", v)}
              placeholder="e.g. 1 cup flour" addLabel="Add ingredient" />
          </Field>

          {/* Steps */}
          <Field label="Method" count={form.steps.filter(Boolean).length}>
            <ListEditor items={form.steps} onChange={v => set("steps", v)}
              placeholder="Step" numbered addLabel="Add step" />
          </Field>

          {/* Tags */}
          <Field label="Tags">
            <TagInput tags={form.tags} onChange={v => set("tags", v)} />
          </Field>

          {/* Submit */}
          <div className="pt-2 border-t border-border flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(isNew ? "/" : `/recipe/${params.id}`)}
              className="flex-1 rounded-full">Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-save"
              className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-white gap-2">
              <Save size={14} />
              {isPending ? "Saving…" : isNew ? "Save Recipe" : "Update Recipe"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

function Field({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
        {count !== undefined && <span className="text-xs text-muted-foreground">{count} items</span>}
      </div>
      {children}
    </div>
  );
}
