import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { NoodleBowl, Tomato, Carrot, Sandwich } from "@/components/Illustrations";
import { FREE_RECIPE_LIMIT } from "@shared/schema";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err: any) {
      const msg = err?.message ?? "";
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      toast({ title: "Sign up failed", description: detail, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* Left — brand panel */}
      <div className="bg-accent hidden md:flex md:w-1/2 flex-col justify-between p-10 relative overflow-hidden">
        <div className="border-2 border-foreground w-fit px-3 py-1.5 rounded-sm">
          <span className="font-bold text-lg leading-none">RecipeSnap</span>
        </div>
        <div>
          <p className="font-bold text-4xl leading-tight max-w-xs">
            Your personal cookbook starts here.
          </p>
          <ul className="mt-4 space-y-2">
            {[
              `${FREE_RECIPE_LIMIT} recipes free — no card needed`,
              "Import from photos, URLs and Instagram",
              "Organise by category and tag",
            ].map(t => (
              <li key={t} className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-end gap-6 opacity-20">
          <NoodleBowl stroke="#000" size={96} />
          <Tomato stroke="#000" size={72} />
          <Carrot stroke="#000" size={80} />
          <Sandwich stroke="#000" size={72} />
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="md:hidden border-2 border-foreground px-3 py-1.5 rounded-sm mb-8">
          <span className="font-bold text-lg leading-none">RecipeSnap</span>
        </div>
        <div className="w-full max-w-sm">
          <h1 className="font-bold text-2xl text-foreground mb-1">Create your account</h1>
          <p className="text-muted-foreground text-sm mb-7">
            Free forever — upgrade anytime for unlimited recipes
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name (optional)" autoFocus
                className="pl-9 rounded-xl bg-muted border-0 focus-visible:ring-primary/40 h-11"
                data-testid="input-name" />
            </div>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="pl-9 rounded-xl bg-muted border-0 focus-visible:ring-primary/40 h-11"
                data-testid="input-email" />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password (min. 6 characters)" required minLength={6}
                className="pl-9 rounded-xl bg-muted border-0 focus-visible:ring-primary/40 h-11"
                data-testid="input-password" />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full rounded-full bg-primary hover:bg-primary/90 text-white h-11 font-bold"
              data-testid="button-signup">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Create free account"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            By signing up you agree to our Terms of Service.
          </p>
          <p className="text-sm text-center text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link href="/login">
              <a className="text-primary font-semibold hover:underline">Sign in</a>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
