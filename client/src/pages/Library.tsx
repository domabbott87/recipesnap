import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recipe } from "@shared/schema";
import { Camera, Search, Heart, Clock, ChefHat, Star, Zap } from "lucide-react";
import { NoodleBowl, Tomato, Carrot, Sandwich } from "@/components/Illustrations";
import { useAuth } from "@/lib/auth";
import { FREE_RECIPE_LIMIT } from "@shared/schema";

function parse<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="aspect-square skeleton-shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

function RecipeCard({ recipe, onFavourite, onDelete }: {
  recipe: Recipe;
  onFavourite: (id: number, val: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const ingredients = parse<string[]>(recipe.ingredients, []);
  const tags = parse<string[]>(recipe.tags, []);

  return (
    <div className="recipe-card rounded-2xl border border-border bg-card overflow-hidden group relative">
      <Link href={`/recipe/${recipe.id}`}>
        <a data-testid={`card-recipe-${recipe.id}`}>
          <div className="aspect-square relative bg-secondary overflow-hidden">
            {recipe.imageDataUrl ? (
              <img
                src={recipe.imageDataUrl}
                alt={recipe.title}
                className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <NoodleBowl stroke="#2338FF" size={52} className="opacity-30" />
              </div>
            )}
          </div>
        </a>
      </Link>

      {/* Favourite toggle */}
      <button
        onClick={() => onFavourite(recipe.id, !recipe.isFavourite)}
        data-testid={`button-fav-${recipe.id}`}
        className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-sm ${
          recipe.isFavourite
            ? "bg-primary text-white"
            : "bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-primary"
        }`}
        aria-label={recipe.isFavourite ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart size={13} fill={recipe.isFavourite ? "currentColor" : "none"} />
      </button>

      <div className="p-3">
        <Link href={`/recipe/${recipe.id}`}>
          <a className="hover:text-primary transition-colors">
            <h3 className="font-bold text-sm text-foreground leading-tight mb-1 line-clamp-2">
              {recipe.title}
            </h3>
          </a>
        </Link>
        {recipe.source && (
          <p className="text-xs text-muted-foreground mb-2">{recipe.source}</p>
        )}
        <div className="flex flex-wrap gap-1">
          {recipe.serves && (
            <span className="badge-blue">
              <ChefHat size={9} />
              {recipe.serves} serves
            </span>
          )}
          {(recipe.prepTime || recipe.cookTime) && (
            <span className="badge-blue">
              <Clock size={9} />
              {recipe.prepTime || recipe.cookTime}
            </span>
          )}
          {tags.slice(0, 1).map(t => (
            <span key={t} className="badge-blue">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-bold text-base text-foreground">{title}</h2>
      {href && count && count > 4 && (
        <Link href={href}>
          <a className="text-xs font-semibold text-primary hover:underline">View all</a>
        </Link>
      )}
    </div>
  );
}

function RecipeGrid({ recipes, onFavourite, onDelete, cols = 2 }: {
  recipes: Recipe[];
  onFavourite: (id: number, val: boolean) => void;
  onDelete: (id: number) => void;
  cols?: number;
}) {
  const gridClass = cols === 2
    ? "grid grid-cols-2 gap-3"
    : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3";

  return (
    <div className={gridClass}>
      {recipes.map(r => (
        <RecipeCard key={r.id} recipe={r} onFavourite={onFavourite} onDelete={onDelete} />
      ))}
    </div>
  );
}

export default function Library() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const atLimit = user?.plan === "free" && (user?.recipeCount ?? 0) >= FREE_RECIPE_LIMIT;

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({ queryKey: ["/api/recipes"] });

  const favMutation = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      apiRequest("PUT", `/api/recipes/${id}`, { isFavourite: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe deleted" });
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return recipes;
    const q = search.toLowerCase();
    return recipes.filter(r => {
      const tags = parse<string[]>(r.tags, []);
      const ing = parse<string[]>(r.ingredients, []);
      return r.title.toLowerCase().includes(q)
        || r.source?.toLowerCase().includes(q)
        || tags.some(t => t.toLowerCase().includes(q))
        || ing.some(i => i.toLowerCase().includes(q));
    });
  }, [recipes, search]);

  const favourites = recipes.filter(r => r.isFavourite);
  const recent = [...recipes].sort((a, b) => (b.createdAt as any) - (a.createdAt as any)).slice(0, 4);

  const handlers = {
    onFavourite: (id: number, val: boolean) => favMutation.mutate({ id, val }),
    onDelete: (id: number) => deleteMutation.mutate(id),
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20 sm:pb-8">

        {/* Search bar */}
        <div className="relative mb-6">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by recipe, ingredient or category"
            className="pl-10 rounded-full bg-muted border-0 focus-visible:ring-primary/40 h-11 text-sm"
            data-testid="input-search"
          />
        </div>

        {/* Free limit banner */}
        {atLimit && (
          <Link href="/profile">
            <a className="flex items-center gap-3 p-3 rounded-xl bg-accent border border-accent text-sm font-semibold text-foreground hover:opacity-90 transition-opacity mb-2">
              <Zap size={16} className="text-primary shrink-0" />
              <span>You've reached the {FREE_RECIPE_LIMIT}-recipe free limit. <span className="text-primary underline">Upgrade to Premium →</span></span>
            </a>
          </Link>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-8">
            <div>
              <div className="h-5 w-28 rounded skeleton-shimmer mb-3" />
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          </div>
        )}

        {/* Search results */}
        {!isLoading && search && (
          <div>
            <SectionHeader title={`Results for "${search}"`} count={filtered.length} />
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">No recipes match your search</p>
                <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="mt-2 text-primary">Clear search</Button>
              </div>
            ) : (
              <RecipeGrid recipes={filtered} {...handlers} cols={3} />
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !search && recipes.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center gap-6">
            {/* Yellow brand block */}
            <div className="rounded-2xl bg-accent p-6 w-56 text-center relative overflow-hidden">
              <p className="font-bold text-xl text-foreground">RecipeSnap</p>
              <div className="mt-2 bg-primary rounded-lg px-3 py-1.5">
                <p className="text-white text-xs font-bold">Your personal cookbook</p>
              </div>
              <div className="absolute -bottom-3 -right-3 opacity-40">
                <NoodleBowl stroke="#1a1a1a" size={70} />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-xl text-foreground mb-1">No recipes yet</h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Take a photo of a recipe card, cookbook page, or handwritten note to get started.
              </p>
            </div>
            <Link href="/snap">
              <Button className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-full px-6">
                <Camera size={15} />
                Snap your first recipe
              </Button>
            </Link>
          </div>
        )}

        {/* Normal library view */}
        {!isLoading && !search && recipes.length > 0 && (
          <div className="space-y-8">

            {/* Favourites + Recently Added (side-by-side on wider screens) */}
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Favourites */}
              <div>
                <SectionHeader title="Favourites" count={favourites.length} href="/collections" />
                {favourites.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center">
                    <Star size={20} className="mx-auto text-muted-foreground mb-2 opacity-40" />
                    <p className="text-xs text-muted-foreground">Tap ♥ on a recipe to save it here</p>
                  </div>
                ) : (
                  <RecipeGrid recipes={favourites.slice(0, 4)} {...handlers} />
                )}
              </div>

              {/* Recently Added */}
              <div>
                <SectionHeader title="Recently Added" count={recipes.length} href="/collections" />
                <RecipeGrid recipes={recent} {...handlers} />
              </div>
            </div>

            {/* Category sections from tags */}
            {["dinner", "baking", "breakfast", "lunch", "hosting", "dessert"].map(category => {
              const cat = recipes.filter(r =>
                parse<string[]>(r.tags, []).some(t => t.toLowerCase() === category)
              );
              if (cat.length === 0) return null;
              return (
                <div key={category}>
                  <SectionHeader
                    title={category.charAt(0).toUpperCase() + category.slice(1)}
                    count={cat.length}
                    href="/collections"
                  />
                  <RecipeGrid recipes={cat.slice(0, 4)} {...handlers} />
                </div>
              );
            })}

            {/* All recipes fallback if no categories */}
            {!["dinner", "baking", "breakfast", "lunch", "hosting", "dessert"].some(c =>
              recipes.some(r => parse<string[]>(r.tags, []).some(t => t.toLowerCase() === c))
            ) && (
              <div>
                <SectionHeader title="All Recipes" count={recipes.length} />
                <RecipeGrid recipes={recipes} {...handlers} cols={3} />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
