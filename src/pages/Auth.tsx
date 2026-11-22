import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import loginBg from "@/assets/login-bg.jpg";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import companyLogoDefault from "@/assets/company-logo.png";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";

const SESSION_EXPIRED_KEY = "mvc_session_expired";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Auth() {
  const { signIn, sessionExpired, clearSessionExpired } = useAuth();
  const { toast } = useToast();
  const { data: companyInfo } = useCompanyInfo();
  const companyLogo = companyInfo?.company_logo_url || companyLogoDefault;
  const companyName = companyInfo?.company_name || "Migrants Venture Corporation";
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showExpiredBanner, setShowExpiredBanner] = useState(sessionExpired);

  // First-time setup state
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupForm, setSetupForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    setup_key: "",
  });
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("has_any_admin");
      if (cancelled) return;
      if (error) {
        // Server re-checks before creating anything, so showing the form is safe.
        console.warn("has_any_admin check failed:", error.message);
        setNeedsSetup(true);
        return;
      }
      setNeedsSetup(data === false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncExpiredBanner = () => {
      const expiredInStorage = localStorage.getItem(SESSION_EXPIRED_KEY) === "true";
      if (sessionExpired || expiredInStorage) {
        setShowExpiredBanner(true);
      }
    };

    syncExpiredBanner();
    window.addEventListener("focus", syncExpiredBanner);
    document.addEventListener("visibilitychange", syncExpiredBanner);

    return () => {
      window.removeEventListener("focus", syncExpiredBanner);
      document.removeEventListener("visibilitychange", syncExpiredBanner);
    };
  }, [sessionExpired]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setShowExpiredBanner(false);
    clearSessionExpired();
    setLoading(true);
    let { error } = await signIn(email, password);
    if (error) {
      // The password may be a temporary reset code sent by email; activate it and retry.
      try {
        const { data: redeem } = await supabase.functions.invoke("forgot-password", {
          body: { action: "redeem", email, code: password },
        });
        if ((redeem as any)?.success) {
          ({ error } = await signIn(email, password));
        }
      } catch {
        /* keep original error */
      }
    }
    setLoading(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    }
    // Navigation is now handled in useAuth based on must_change_password flag
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotEmail || !z.string().email().safeParse(forgotEmail).success) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setForgotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("forgot-password", {
        body: { email: forgotEmail },
      });

      if (error) throw error;

      setForgotSuccess(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred. Please try again.",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail("");
    setForgotSuccess(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { first_name, last_name, email: setupEmail, password: setupPassword, confirm_password } = setupForm;
    if (!first_name.trim() || !last_name.trim()) {
      toast({ variant: "destructive", title: "Missing information", description: "Please enter your first and last name." });
      return;
    }
    if (!z.string().email().safeParse(setupEmail).success) {
      toast({ variant: "destructive", title: "Invalid email", description: "Please enter a valid email address." });
      return;
    }
    if (setupPassword.length < 8) {
      toast({ variant: "destructive", title: "Weak password", description: "Password must be at least 8 characters." });
      return;
    }
    if (setupPassword !== confirm_password) {
      toast({ variant: "destructive", title: "Passwords do not match", description: "Please retype your password." });
      return;
    }

    setSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-first-admin", {
        body: { first_name, last_name, email: setupEmail, password: setupPassword, setup_key: setupForm.setup_key },
      });
      if (error || (data && (data as any).error)) {
        let message = (data as any)?.error as string | undefined;
        const ctx = (error as any)?.context;
        if (!message && ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            message = body?.error;
          } catch {
            /* ignore */
          }
        }
        if (message?.toLowerCase().includes("already completed")) setNeedsSetup(false);
        throw new Error(message || error?.message || "Setup failed");
      }
      toast({ title: "Setup complete", description: "Your HR account has been created. Please sign in." });
      setNeedsSetup(false);
      setEmail(setupEmail);
      setPassword("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Setup failed", description: err.message ?? "Please try again." });
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src={companyLogo} alt={companyName} className="w-20 h-20 object-contain mb-4" />
          <h1 className="text-2xl font-bold text-foreground">{companyName}</h1>
          <p className="text-muted-foreground mt-1">HR & Payroll Management System</p>
        </div>

        <Card className="shadow-xl border-border/50">
          {needsSetup === null ? (
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          ) : needsSetup ? (
            <>
              <CardHeader>
                <CardTitle className="text-lg">First-Time Setup</CardTitle>
                <CardDescription>
                  No admin account exists yet. Create the first HR account to get started. This form appears only once.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSetup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="setup-first">First Name</Label>
                      <Input
                        id="setup-first"
                        value={setupForm.first_name}
                        onChange={(e) => setSetupForm((f) => ({ ...f, first_name: e.target.value }))}
                        disabled={setupLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="setup-last">Last Name</Label>
                      <Input
                        id="setup-last"
                        value={setupForm.last_name}
                        onChange={(e) => setSetupForm((f) => ({ ...f, last_name: e.target.value }))}
                        disabled={setupLoading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-key">Setup Key</Label>
                    <Input
                      id="setup-key"
                      type="password"
                      value={setupForm.setup_key}
                      onChange={(e) => setSetupForm((f) => ({ ...f, setup_key: e.target.value }))}
                      disabled={setupLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-email">Email</Label>
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="hr@company.com"
                      value={setupForm.email}
                      onChange={(e) => setSetupForm((f) => ({ ...f, email: e.target.value }))}
                      disabled={setupLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-password">Password</Label>
                    <PasswordInput
                      id="setup-password"
                      placeholder="At least 8 characters"
                      value={setupForm.password}
                      onChange={(e) => setSetupForm((f) => ({ ...f, password: e.target.value }))}
                      disabled={setupLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-confirm">Confirm Password</Label>
                    <PasswordInput
                      id="setup-confirm"
                      placeholder="Retype password"
                      value={setupForm.confirm_password}
                      onChange={(e) => setSetupForm((f) => ({ ...f, confirm_password: e.target.value }))}
                      disabled={setupLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={setupLoading}>
                    {setupLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create HR Account"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-lg">Welcome Back</CardTitle>
                <CardDescription>Enter your credentials to access your account</CardDescription>
                {showExpiredBanner && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>Your session has expired due to inactivity. Please sign in again.</AlertDescription>
                  </Alert>
                )}
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <PasswordInput
                      id="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Log in"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-muted-foreground text-sm mt-6">
          © 2026 Migrants Venture Corporation. All rights reserved.
        </p>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={closeForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              {forgotSuccess
                ? "Check your email for further instructions."
                : "Enter your email address and we'll send you a temporary password."}
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-green-700 dark:text-green-400 font-medium">Password Reset Email Sent!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If an account exists with this email, you will receive a temporary password shortly.
                </p>
              </div>
              <Button onClick={closeForgotPassword} className="w-full">
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@company.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={forgotLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeForgotPassword}
                  className="flex-1"
                  disabled={forgotLoading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Email"
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
