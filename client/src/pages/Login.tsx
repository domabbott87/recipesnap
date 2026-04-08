import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock } from "lucide-react";
import { NoodleBowl, Tomato, Carrot, Sandwich } from "@/components/Illustrations";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      const msg = err?.message ?? "";
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      toast({ title: "Login failed", description: detail || "Invalid email or password.", variant: "destructive" });
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
            Capture, Organise and Cook.
          </p>
          <p className="mt-3 text-foreground/70 font-medium">Your digital culinary companion.</p>
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
        {/* Mobile logo */}
        <div className="md:hidden border-2 border-foreground px-3 py-1.5 rounded-sm mb-8">
          <span className="font-bold text-lg leading-none">RecipeSnap</span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="font-bold text-2xl text-foreground mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-7">Sign in to your cookbook</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoFocus
                className="pl-9 rounded-xl bg-muted border-0 focus-visible:ring-primary/40 h-11"
                data-testid="input-email" />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" required
                className="pl-9 rounded-xl bg-muted border-0 focus-visible:ring-primary/40 h-11"
                data-testid="input-password" />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full rounded-full bg-primary hover:bg-primary/90 text-white h-11 font-bold"
              data-testid="button-login">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link href="/signup">
              <a className="text-primary font-semibold hover:underline">Create one free</a>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
