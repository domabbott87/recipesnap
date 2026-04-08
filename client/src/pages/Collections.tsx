import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Recipe } from "@shared/schema";
import { Heart, Clock, ChefHat, Camera, Grid3X3 } from "lucide-react";
import { NoodleBowl } from "@/components/Illustrations";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

function parse<T>(s: string | null | undefined, fallback: T): T {
  try { return s ? JSON.parse(s) : fallback; }
  catch { return fallback; }
}

const CATEGORIES = [
  "Favourites",
  "Dinner", "Baking", "Breakfast", "Lunch",
  "Hosting", "Dessert", "Snacks",
];

function RecipeRow({ recipe, onFavourite }: {
  recipe: Recipe;
  onFavourite: (id: number, val: boolean) => void;
}) {
  return (
    <Link href={`/recipe/${recipe.id}`}>
      <a
        data-testid={`row-recipe-${recipe.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-xl bg-secondary shrink-0 overflow-hidden">
          {recipe.imageDataUrl ? (
            <img
              src={recipe.imageDataUrl}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <NoodleBowl stroke="#2338FF" size={28} className="opacity-30" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground truncate">{recipe.title}</p>
          {recipe.source && (
            <p className="text-xs text-muted-foreground truncate">{recipe.source}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1">
            {recipe.serves && (
              <span className="badge-blue"><ChefHat size={9} />{recipe.serves} serves</span>
            )}
            {(recipe.prepTime || recipe.cookTime) && (
              <span className="badge-blue"><Clock size={9} />{recipe.prepTime || recipe.cookTime}</span>
            )}
          </div>
        </div>

        {/* Favourite */}
        <button
          onClick={e => { e.preventDefault(); onFavourite(recipe.id, !recipe.isFavourite); }}
          data-testid={`fav-${recipe.id}`}
          className={`shrink-0 p-1.5 rounded-full transition-colors ${
            recipe.isFavourite ? "text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Heart size={15} fill={recipe.isFavourite ? "currentColor" : "none"} />
        </button>
      </a>
    </Link>
  );
}

function CollectionCard({
  title, recipes, onFavourite, emptyHint, icon,
}: {
  title: string;
  recipes: Recipe[];
  onFavourite: (id: number, val: boolean) => void;
  emptyHint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="font-bold text-sm text-foreground">{title}</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </span>
      </div>

      {/* Content */}
      {recipes.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {recipes.slice(0, 5).map(r => (
            <RecipeRow key={r.id} recipe={r} onFavourite={onFavourite} />
          ))}
          {recipes.length > 5 && (
            <div className="px-4 py-2.5 text-center">
              <span className="text-xs text-primary font-bold">+{recipes.length - 5} more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Collections() {
  const { user } = useAuth();
  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const favMutation = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      apiRequest("PUT", `/api/recipes/${id}`, { isFavourite: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recipes"] }),
  });

  const onFavourite = (id: number, val: boolean) => favMutation.mutate({ id, val });

  const getByCategory = (cat: string): Recipe[] => {
    if (cat === "Favourites") return recipes.filter(r => r.isFavourite);
    return recipes.filter(r =>
      parse<string[]>(r.tags, []).some(t => t.toLowerCase() === cat.toLowerCase())
    );
  };

  // Which categories have recipes (excluding Favourites which always shows)
  const activeCategories = CATEGORIES.slice(1).filter(c => getByCategory(c).length > 0);

  // Skeleton
  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8 space-y-4">
          <div className="h-7 w-36 rounded skeleton-shimmer" />
          <div className="grid sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl skeleton-shimmer" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // No recipes at all — empty state
  if (recipes.length === 0) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 pb-24 flex flex-col items-center text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
            <Grid3X3 size={32} className="text-primary opacity-50" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground mb-1">No collections yet</h2>
            <p className="text-muted-foreground text-sm max-w-xs">
              Save recipes and tag them (e.g. "dinner", "baking") to organise them into collections.
              Favourite a recipe to pin it here too.
            </p>
          </div>
          <Link href="/snap">
            <Button className="rounded-full bg-primary text-white gap-2 px-6">
              <Camera size={15} />
              Snap your first recipe
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-8">

        {/* Page header */}
        <div className="mb-5">
          <h1 className="font-bold text-xl text-foreground">Collections</h1>
          {user && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {recipes.length} recipe{recipes.length !== 1 ? "s" : ""} saved
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Favourites — always first */}
          <CollectionCard
            title="Favourites"
            recipes={getByCategory("Favourites")}
            onFavourite={onFavourite}
            emptyHint="Tap ♥ on any recipe to pin it here"
            icon={<Heart size={14} className="text-primary" fill="currentColor" />}
          />

          {/* Active tag-based categories */}
          {activeCategories.map(cat => (
            <CollectionCard
              key={cat}
              title={cat}
              recipes={getByCategory(cat)}
              onFavourite={onFavourite}
              emptyHint={`Tag recipes with "${cat.toLowerCase()}" to see them here`}
            />
          ))}

          {/* Suggest inactive categories only when there are no tagged recipes */}
          {activeCategories.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 flex flex-col items-center text-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground">Add tags to create collections</p>
              <p className="text-xs text-muted-foreground">
                Tag your recipes with labels like <strong>dinner</strong>, <strong>baking</strong> or <strong>dessert</strong> and they'll appear here automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
