import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import type { UserPreferences } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, Crown, ChefHat, Camera, BookOpen,
  Pencil, Check, X, Zap, Infinity, Shield, Headphones,
  Sparkles,
} from "lucide-react";
import { Analytics } from "@/lib/analytics";
import { FREE_RECIPE_LIMIT } from "@shared/schema";

// ── Chip multi-select ──────────────────────────────────────────────────────
function ChipGroup({
  options, selected, onToggle, max,
}: {
  options: string[]; selected: string[];
  onToggle: (v: string) => void; max?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        const disabled = !active && max !== undefined && selected.length >= max;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              active
                ? "bg-primary text-white border-primary"
                : disabled
                ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-secondary"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <h2 className="font-bold text-sm text-foreground">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Check/cross icon ──────────────────────────────────────────────────────
function FeatureIcon({ yes }: { yes: boolean }) {
  return yes ? (
    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
      <Check size={11} strokeWidth={3} className="text-white" />
    </div>
  ) : (
    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
      <X size={10} strokeWidth={2.5} className="text-muted-foreground/50" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free",
  "Nut-Free", "Halal", "Kosher", "Low-Carb",
];
const CUISINE_OPTIONS = [
  "Italian", "Asian", "Mexican", "French", "Indian",
  "Mediterranean", "Japanese", "Thai", "Middle Eastern", "American",
];

export default function Profile() {
  const { user, logout, updateName, updatePreferences } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Name edit state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Billing toggle
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  if (!user) return null;

  const isFree = user.plan === "free";
  const prefs = user.preferences;
  const usedPct = isFree ? Math.min((user.recipeCount / FREE_RECIPE_LIMIT) * 100, 100) : 100;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue === user.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await updateName(nameValue.trim());
      setEditingName(false);
      toast({ title: "Name updated" });
    } catch { toast({ title: "Failed to update name", variant: "destructive" }); }
    finally { setSavingName(false); }
  };

  const handleCancelName = () => { setNameValue(user.name ?? ""); setEditingName(false); };

  const toggleDietary = async (val: string) => {
    const current = prefs.dietary ?? [];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    await updatePreferences({ dietary: next });
  };

  const toggleCuisine = async (val: string) => {
    const current = prefs.cuisines ?? [];
    const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val];
    await updatePreferences({ cuisines: next });
  };

  const handleLogout = async () => { await logout(); navigate("/login"); };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-10 space-y-4">

        {/* ── User header ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-2xl">
                {(user.name ?? user.email)[0].toUpperCase()}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {/* Name row */}
              {editingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <Input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") handleCancelName(); }}
                    className="h-8 text-sm font-bold bg-muted border-0 focus-visible:ring-primary/40 rounded-lg"
                  />
                  <button onClick={handleSaveName} disabled={savingName}
                    className="p-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 shrink-0">
                    <Check size={13} />
                  </button>
                  <button onClick={handleCancelName}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-foreground truncate">{user.name ?? "Chef"}</p>
                  <button
                    onClick={() => { setNameValue(user.name ?? ""); setEditingName(true); }}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  isFree ? "bg-muted text-muted-foreground" : "bg-accent text-foreground"
                }`}>
                  {isFree ? <BookOpen size={11} /> : <Crown size={11} />}
                  {isFree ? "Free plan" : "Premium"}
                </span>
                {isFree && (
                  <span className="text-xs text-muted-foreground">
                    {user.recipeCount} / {FREE_RECIPE_LIMIT} recipes used
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Storage bar for free users */}
          {isFree && (
            <div className="mt-4 space-y-1.5">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usedPct >= 90 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              {user.recipeCount >= FREE_RECIPE_LIMIT - 2 && (
                <p className="text-xs font-semibold text-destructive">
                  {user.recipeCount >= FREE_RECIPE_LIMIT
                    ? "Storage full — upgrade to save more recipes"
                    : `${FREE_RECIPE_LIMIT - user.recipeCount} recipe${FREE_RECIPE_LIMIT - user.recipeCount !== 1 ? "s" : ""} remaining on free plan`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Upgrade section (free users) ──────────────────────────────── */}
        {isFree && (
          <div className="rounded-2xl overflow-hidden border border-primary/20">
            {/* Yellow header */}
            <div className="bg-accent px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-foreground" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Unlock everything</span>
                  </div>
                  <h2 className="font-bold text-2xl text-foreground leading-tight">Upgrade to Premium</h2>
                  <p className="text-sm text-foreground/70 mt-1">
                    No limits. Every feature. Forever in your pocket.
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Crown size={22} className="text-white" />
                </div>
              </div>

              {/* Billing toggle */}
              <div className="flex gap-0 bg-foreground/10 rounded-xl p-1 mt-4 w-fit">
                {(["monthly", "annual"] as const).map(b => (
                  <button
                    key={b}
                    onClick={() => setBilling(b)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                      billing === b ? "bg-foreground text-background shadow-sm" : "text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {b === "annual" ? "Annual" : "Monthly"}
                    {b === "annual" && (
                      <span className="absolute -top-2.5 -right-2 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                        SAVE 16%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* White pricing + CTA area */}
            <div className="bg-card px-5 py-4 space-y-4">
              {/* Price */}
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-4xl text-foreground">
                  {billing === "annual" ? "$2.50" : "$2.99"}
                </span>
                <span className="text-muted-foreground text-sm">/ month</span>
                {billing === "annual" && (
                  <span className="text-xs text-muted-foreground ml-1">· billed $29.99 / year</span>
                )}
              </div>

              {/* Feature list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { icon: Infinity, label: "Unlimited recipe storage" },
                  { icon: Camera, label: "All import methods" },
                  { icon: Zap, label: "Priority AI processing" },
                  { icon: Shield, label: "Early access to new features" },
                  { icon: Headphones, label: "Priority email support" },
                  { icon: ChefHat, label: "Smart recipe suggestions" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon size={10} className="text-primary" />
                    </div>
                    <span className="text-sm text-foreground font-medium">{label}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                onClick={() => Analytics.upgradeCtaClicked(billing)}
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-base gap-2">
                <Crown size={16} />
                Start Premium
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Cancel anytime · No hidden fees · Secure payment
              </p>
            </div>
          </div>
        )}

        {/* Premium confirmed */}
        {!isFree && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Crown size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground">Premium active</p>
              <p className="text-sm text-muted-foreground">Unlimited recipes and all features unlocked.</p>
            </div>
          </div>
        )}

        {/* ── Preferences ───────────────────────────────────────────────── */}
        <Section title="Preferences">
          <div className="space-y-6">

            {/* Units */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Measurement units</p>
              <div className="flex gap-0 bg-muted rounded-xl p-1 w-fit">
                {(["metric", "us"] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => updatePreferences({ units: u })}
                    className={`px-5 py-2 rounded-[10px] text-sm font-bold transition-all ${
                      prefs.units === u ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {u === "metric" ? "Metric" : "US"}
                  </button>
                ))}
              </div>
            </div>

            {/* Default serves */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Default serves</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updatePreferences({ defaultServes: Math.max(1, prefs.defaultServes - 1) })}
                  className="serves-btn"
                >−</button>
                <span className="font-bold text-lg w-8 text-center">{prefs.defaultServes}</span>
                <button
                  onClick={() => updatePreferences({ defaultServes: Math.min(20, prefs.defaultServes + 1) })}
                  className="serves-btn"
                >+</button>
                <span className="text-sm text-muted-foreground ml-1">people</span>
              </div>
            </div>

            {/* Dietary preferences */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Dietary preferences
                {prefs.dietary.length > 0 && (
                  <span className="ml-2 text-primary font-bold">{prefs.dietary.length} selected</span>
                )}
              </p>
              <ChipGroup
                options={DIETARY_OPTIONS}
                selected={prefs.dietary}
                onToggle={toggleDietary}
              />
            </div>

            {/* Favourite cuisines */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Favourite cuisines
                {prefs.cuisines.length > 0 && (
                  <span className="ml-2 text-primary font-bold">{prefs.cuisines.length} selected</span>
                )}
              </p>
              <ChipGroup
                options={CUISINE_OPTIONS}
                selected={prefs.cuisines}
                onToggle={toggleCuisine}
              />
            </div>
          </div>
        </Section>

        {/* ── Plan includes ─────────────────────────────────────────────── */}
        <Section title="Your plan">
          <div className="space-y-3">
            {[
              { label: isFree ? `Up to ${FREE_RECIPE_LIMIT} saved recipes` : "Unlimited saved recipes", yes: true },
              { label: "Photo, URL & Instagram import", yes: true },
              { label: "Smart recipe collections", yes: true },
              { label: "Cook mode (interactive steps)", yes: true },
              { label: "Unlimited recipes", yes: !isFree },
              { label: "Priority AI processing", yes: !isFree },
              { label: "Priority support", yes: !isFree },
              { label: "Early access features", yes: !isFree },
            ].map(({ label, yes }) => (
              <div key={label} className="flex items-center gap-3">
                <FeatureIcon yes={yes} />
                <span className={`text-sm ${yes ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {!yes && isFree && (
                  <span className="ml-auto text-xs text-primary font-bold">Premium</span>
                )}
              </div>
            ))}
          </div>
          {isFree && (
            <button
              onClick={() => document.getElementById("upgrade-section")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full mt-4 py-2.5 rounded-full border-2 border-primary text-primary text-sm font-bold hover:bg-secondary transition-colors"
            >
              See upgrade options ↑
            </button>
          )}
        </Section>

        {/* ── Account ───────────────────────────────────────────────────── */}
        <Section title="Account">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground truncate ml-4 max-w-xs">{user.email}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium text-foreground">April 2026</span>
            </div>
            <div className="pt-2 border-t border-border">
              <button
                onClick={handleLogout}
                data-testid="button-logout"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </Section>

      </div>
    </Layout>
  );
}
