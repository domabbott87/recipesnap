import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe } from "@shared/schema";
import { ArrowLeft, Pencil, Trash2, Share2, CheckCircle2, Circle, Clock, ChefHat, Heart } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Analytics } from "@/lib/analytics";
import { NoodleBowl } from "@/components/Illustrations";

function parse<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}

function SkeletonDetail() {
  return (
    <div className="animate-pulse space-y-4 py-8">
      <div className="h-48 rounded-2xl skeleton-shimmer" />
      <div className="h-8 w-2/3 rounded skeleton-shimmer" />
      <div className="h-4 w-1/4 rounded skeleton-shimmer" />
    </div>
  );
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { user, updatePreferences } = useAuth();
  const [activeTab, setActiveTab] = useState<"ingredients" | "method">("ingredients");
  const [serves, setServes] = useState<number | null>(null);
  // Initialise unit from user preference, fallback to metric
  const [unit, setUnit] = useState<"US" | "M">(
    user?.preferences?.units === "us" ? "US" : "M"
  );

  const handleUnitChange = (u: "US" | "M") => {
    setUnit(u);
    // Persist back to preferences
    updatePreferences({ units: u === "US" ? "us" : "metric" }).catch(() => {});
  };
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const { data: recipe, isLoading } = useQuery<Recipe>({
    queryKey: ["/api/recipes", id],
  });

  // Track recipe view once loaded
  useEffect(() => {
    if (recipe?.title) Analytics.recipeViewed(recipe.title);
  }, [recipe?.title]);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      Analytics.recipeDeleted();
      toast({ title: "Recipe deleted" });
      navigate("/");
    },
  });

  const favMutation = useMutation({
    mutationFn: (val: boolean) => apiRequest("PUT", `/api/recipes/${id}`, { isFavourite: val }),
    onSuccess: (_data, val) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", id] });
      Analytics.recipeFavourited(val);
    },
  });

  if (isLoading) return <Layout><div className="max-w-2xl mx-auto px-4 sm:px-6"><SkeletonDetail /></div></Layout>;

  if (!recipe) return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <NoodleBowl stroke="#2338FF" size={64} className="mx-auto opacity-30 mb-4" />
        <h2 className="font-bold text-xl mb-3">Recipe not found</h2>
        <Button variant="outline" onClick={() => navigate("/")}>Back to Library</Button>
      </div>
    </Layout>
  );

  const ingredients = parse<string[]>(recipe.ingredients, []);
  const steps = parse<string[]>(recipe.steps, []);
  const tags = parse<string[]>(recipe.tags, []);
  const currentServes = serves ?? recipe.serves ?? 4;
  const progress = steps.length ? Math.round((completedSteps.size / steps.length) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20 sm:pb-8">

        {/* Top action bar */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <button
            onClick={() => navigate("/")}
            data-testid="button-back"
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              onClick={() => favMutation.mutate(!recipe.isFavourite)}
              data-testid="button-fav"
              className={`p-2 rounded-full border transition-colors ${
                recipe.isFavourite
                  ? "bg-primary border-primary text-white"
                  : "border-border text-muted-foreground hover:text-primary hover:border-primary"
              }`}
            >
              <Heart size={15} fill={recipe.isFavourite ? "currentColor" : "none"} />
            </button>
            <button className="p-2 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors">
              <Share2 size={15} />
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/recipe/${id}/edit`)}
              data-testid="button-edit"
              className="gap-1.5 rounded-full"
            >
              <Pencil size={13} />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete"
              className="gap-1.5 rounded-full text-destructive hover:text-destructive hover:border-destructive/30"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        </div>

        {/* Hero image */}
        {recipe.imageDataUrl && (
          <div className="rounded-2xl overflow-hidden mb-5 border border-border">
            <img
              src={recipe.imageDataUrl}
              alt={recipe.title}
              className="w-full max-h-56 object-cover"
              data-testid="img-recipe"
            />
          </div>
        )}

        {/* Title, source, tags */}
        <h1 className="font-bold text-2xl text-primary mb-1" data-testid="text-title">
          {recipe.title}
        </h1>
        {recipe.source && (
          <p className="text-sm font-semibold text-primary/70 mb-2">{recipe.source}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map(tag => (
              <span key={tag} className="badge-blue">{tag}</span>
            ))}
          </div>
        )}

        {/* Serves + Units + Times */}
        <div className="rounded-2xl border border-border bg-card p-4 mb-5 space-y-4">
          {/* Row 1: Serves + Units */}
          <div className="flex items-center gap-6">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Serves</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setServes(Math.max(1, currentServes - 1))} className="serves-btn" data-testid="button-serves-minus">−</button>
                <span className="font-bold text-lg w-6 text-center">{currentServes}</span>
                <button onClick={() => setServes(currentServes + 1)} className="serves-btn" data-testid="button-serves-plus">+</button>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Units</p>
              <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
                {(["US", "M"] as const).map(u => (
                  <button key={u} onClick={() => handleUnitChange(u)}
                    className={`unit-btn ${unit === u ? "unit-btn-active" : "unit-btn-inactive"}`}
                    data-testid={`button-unit-${u.toLowerCase()}`}>{u}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Times (only shown if any time info available) */}
          {(recipe.prepTime || recipe.cookTime) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-border/60">
              {recipe.prepTime && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={11} />
                  <span>Prep: <strong className="text-foreground">{recipe.prepTime}</strong></span>
                </div>
              )}
              {recipe.cookTime && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={11} />
                  <span>Cook: <strong className="text-foreground">{recipe.cookTime}</strong></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-5">
          {(["ingredients", "method"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
              className={`px-5 py-2.5 text-sm font-bold capitalize transition-colors ${
                activeTab === tab ? "tab-active" : "tab-inactive"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Ingredients tab */}
        {activeTab === "ingredients" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">{checked.size}/{ingredients.length} checked</p>
              {checked.size > 0 && (
                <button onClick={() => setChecked(new Set())}
                  className="text-xs text-primary font-semibold hover:underline">Clear all</button>
              )}
            </div>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border/60">
              {ingredients.map((item, i) => (
                <button
                  key={i}
                  onClick={() => setChecked(prev => {
                    const n = new Set(prev);
                    n.has(i) ? n.delete(i) : n.add(i);
                    return n;
                  })}
                  data-testid={`ingredient-${i}`}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors ${
                    checked.has(i) ? "opacity-50" : ""
                  }`}
                >
                  {checked.has(i)
                    ? <CheckCircle2 size={16} className="text-primary shrink-0" />
                    : <Circle size={16} className="text-muted-foreground/50 shrink-0" />
                  }
                  <span className={`text-sm ${checked.has(i) ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Method tab */}
        {activeTab === "method" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">{completedSteps.size}/{steps.length} completed</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{progress}%</span>
              </div>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setCompletedSteps(prev => {
                    const n = new Set(prev);
                    n.has(i) ? n.delete(i) : n.add(i);
                    return n;
                  })}
                  data-testid={`step-${i}`}
                  className={`w-full text-left rounded-2xl border p-4 flex gap-3 hover:bg-muted/30 transition-all ${
                    completedSteps.has(i) ? "border-primary/30 bg-secondary/40" : "border-border bg-card"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors font-bold text-xs ${
                    completedSteps.has(i)
                      ? "bg-primary border-primary text-white"
                      : "border-primary text-primary"
                  }`}>
                    {completedSteps.has(i) ? <CheckCircle2 size={13} /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-primary mb-1">Step {i + 1}</p>
                    <p className={`text-sm leading-relaxed ${
                      completedSteps.has(i) ? "text-muted-foreground line-through" : "text-foreground"
                    }`}>{step}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
