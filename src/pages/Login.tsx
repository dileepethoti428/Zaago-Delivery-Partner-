import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { pageTransition, pageTransitionConfig } from "@/animation/variants";
import { Truck, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { loginSchema, signupSchema, type LoginFormData, type SignupFormData } from "@/utils/validation";
import { agentSession } from "@/utils/agentSession";
import { cache } from "@/utils/cache";
import { advancedCache } from "@/utils/advancedCache";
import { queryClient } from "@/providers/AppProviders";
import { registerFCMToken } from "@/utils/fcm";

type Mode = "login" | "signup" | "reset";

const PROFILE_TIMEOUT_MS = 7000;

// Helper: timeout-protected fetchProfile
async function fetchProfileWithTimeout(fetchProfile: () => Promise<void>): Promise<boolean> {
  try {
    await Promise.race([
      fetchProfile(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("profile_timeout")), PROFILE_TIMEOUT_MS)
      ),
    ]);
    return true; // profile loaded
  } catch {
    return false; // timed out or errored
  }
}

// Helper function to ensure agent exists in delivery_agents table
async function ensureAgentExists() {
  try {
    console.log("[Login] Ensuring agent exists in delivery_agents...");
    const { data, error } = await supabase.functions.invoke("ensure-agent-exists");
    if (error) {
      console.error("[Login] Error ensuring agent exists:", error);
      return false;
    }
    console.log("[Login] Agent ensured:", data);
    return true;
  } catch (error) {
    console.error("[Login] Failed to ensure agent exists:", error);
    return false;
  }
}

// Helper function to sync location - called after login/signup
// CRITICAL: This is completely NON-BLOCKING - failures never affect login/navigation
async function syncLocationAfterAuth(): Promise<void> {
  try {
    if (!navigator.geolocation) {
      console.warn("[Login] Geolocation not supported - continuing without location sync");
      return;
    }

    let position: GeolocationPosition;
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        });
      });
    } catch (geoError) {
      console.warn("[Login] Geolocation unavailable - continuing without location sync:", geoError);
      return;
    }

    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    console.log("[Login] Attempting location sync:", { latitude, longitude });

    try {
      const { data, error } = await supabase.functions.invoke("update-agent-location", {
        body: { latitude, longitude, accuracy, heading: heading ?? undefined, speed: speed ?? undefined },
      });

      if (error) {
        console.warn("[Login] Location sync edge function error (non-blocking):", error);
      } else if (data?.success === false) {
        console.warn("[Login] Location sync returned non-success (non-blocking):", data?.reason || "unknown");
      } else {
        console.log("[Login] Location synced successfully");
      }
    } catch (invokeError) {
      console.warn("[Login] Location sync invoke failed (non-blocking):", invokeError);
    }
  } catch (unexpectedError) {
    console.warn("[Login] Unexpected error in location sync (non-blocking):", unexpectedError);
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { session, profile, profileState, fetchProfile } = useAuthStore();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  // Redirect if already authenticated (e.g. browser back button)
  useEffect(() => {
    if (!session) return;

    // Profile is ready — route based on status
    if (profile && profileState === "ready") {
      if (!profile.documents_submitted) {
        navigate("/upload-documents");
      } else if (profile.approval_status === "pending") {
        navigate("/pending-approval");
      } else if (profile.approval_status === "rejected") {
        navigate("/rejected");
      } else if (profile.approval_status === "deactivated" || profile.isActive === false) {
        navigate("/deactivated");
      } else if (profile.approval_status === "approved") {
        navigate("/my-deliveries");
      }
      return;
    }

    // Profile missing — new user
    if (profileState === "missing") {
      navigate("/upload-documents");
      return;
    }

    // For error/loading/idle: do nothing here — let handleLogin's own navigation handle it
    // This prevents the login -> splash -> login ping-pong loop
  }, [session, profile, profileState, navigate]);

  // Listen for PASSWORD_RECOVERY event from reset link
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        const isInvalidCredentials = error.message.toLowerCase().includes("invalid");
        toast({
          title: "Login failed",
          description: isInvalidCredentials
            ? "Invalid email or password. If you don't have an account, please create one first."
            : error.message,
          variant: "destructive",
        });
        return; // finally will clear loading
      }

      const newUserId = authData.user?.id;
      const previousAgentId = agentSession.getCurrentAgentId();

      if (newUserId) {
        agentSession.setCurrentAgentId(newUserId);
      }

      if (previousAgentId && previousAgentId !== newUserId) {
        console.log("🔄 Different agent detected, clearing all caches...");
        cache.clearAll();
        advancedCache.clear();
        queryClient.clear();
      }

      // Timeout-protected profile fetch
      const profileLoaded = await fetchProfileWithTimeout(fetchProfile);

      // Block deactivated agents immediately at login
      const currentProfile = useAuthStore.getState().profile;
      if (currentProfile?.approval_status === "deactivated" || currentProfile?.isActive === false) {
        toast({
          title: "Account Deactivated",
          description: "Your account has been deactivated. Please contact support on WhatsApp.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      // Non-blocking tasks
      ensureAgentExists();
      syncLocationAfterAuth();
      registerFCMToken();

      if (!profileLoaded) {
        toast({
          title: "Signed in",
          description: "Loading your account details…",
        });
        // Navigate directly instead of bouncing to splash
        navigate("/my-deliveries");
      }
      // If profileLoaded, useEffect redirect will handle navigation
    } catch (err) {
      console.error("[Login] Unexpected login error:", err);
      toast({
        title: "Login error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (authData.user) {
        const newUserId = authData.user.id;
        const previousAgentId = agentSession.getCurrentAgentId();

        agentSession.setCurrentAgentId(newUserId);

        if (previousAgentId && previousAgentId !== newUserId) {
          console.log("🔄 Different agent detected during signup, clearing all caches...");
          cache.clearAll();
          advancedCache.clear();
          queryClient.clear();
        }

        const { error: profileError } = await supabase.from("profiles").insert({
          user_id: newUserId,
          approval_status: "pending",
          documents_submitted: false,
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
        }

        toast({
          title: "Account created",
          description: "Please upload your documents to continue",
        });

        await fetchProfileWithTimeout(fetchProfile);

        // Non-blocking tasks
        ensureAgentExists();
        syncLocationAfterAuth();
        registerFCMToken();

        navigate("/upload-documents");
      }
    } catch (err) {
      console.error("[Login] Unexpected signup error:", err);
      toast({
        title: "Signup error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const email = loginForm.getValues("email");
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://zaago-rider.vercel.app/login",
      });

      if (error) {
        toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "Password reset link has been sent" });
        setMode("login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransitionConfig}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="p-4 bg-primary rounded-2xl shadow-lg">
            <Truck className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Zaago Delivery Partner</h1>
        </div>

        <Card className="rounded-2xl shadow-xl border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>
              {mode === "login" && "Welcome back"}
              {mode === "signup" && "Create account"}
              {mode === "reset" && "Reset password"}
            </CardTitle>
            <CardDescription>
              {mode === "login" && "Sign in to your delivery partner account"}
              {mode === "signup" && "Join as a delivery partner"}
              {mode === "reset" && "Enter your email to receive a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "login" && (
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="partner@zaago.com" className="rounded-xl" {...loginForm.register("email")} />
                  {loginForm.formState.errors.email && <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" className="rounded-xl" {...loginForm.register("password")} />
                  {loginForm.formState.errors.password && <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" className="w-full rounded-xl h-11 text-base font-medium" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
                <div className="flex justify-between text-sm">
                  <button type="button" onClick={() => setMode("reset")} className="text-primary hover:underline">Forgot password?</button>
                  <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">Create account</button>
                </div>
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="partner@zaago.com" className="rounded-xl" {...signupForm.register("email")} />
                  {signupForm.formState.errors.email && <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" type="password" placeholder="••••••••" className="rounded-xl" {...signupForm.register("password")} />
                  {signupForm.formState.errors.password && <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input id="confirm-password" type="password" placeholder="••••••••" className="rounded-xl" {...signupForm.register("confirmPassword")} />
                  {signupForm.formState.errors.confirmPassword && <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>}
                </div>
                <Button type="submit" className="w-full rounded-xl h-11 text-base font-medium" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
                <div className="text-center text-sm">
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Already have an account? Sign in</button>
                </div>
              </form>
            )}

            {mode === "reset" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" placeholder="partner@zaago.com" className="rounded-xl" {...loginForm.register("email")} />
                </div>
                <Button onClick={handleResetPassword} className="w-full rounded-xl h-11 text-base font-medium" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
                </Button>
                <div className="text-center text-sm">
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">Back to sign in</button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
