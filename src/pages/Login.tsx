import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Mail, Lock, User, Truck, Eye, EyeOff, Upload, FileText, Calendar } from "lucide-react";

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[0-9]{10}$/, "Phone must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  aadharNumber: z.string().regex(/^[0-9]{12}$/, "Aadhar must be 12 digits"),
  aadharFront: z.any().refine((file) => file?.length > 0, "Aadhar front image required"),
  aadharBack: z.any().refine((file) => file?.length > 0, "Aadhar back image required"),
  dlNumber: z.string().min(5, "Enter valid DL number"),
  dlFront: z.any().refine((file) => file?.length > 0, "DL front image required"),
  dlBack: z.any().refine((file) => file?.length > 0, "DL back image required"),
  dlExpiry: z.string().min(1, "DL expiry date required"),
  profilePhoto: z.any().refine((file) => file?.length > 0, "Profile photo required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

// Password strength calculator
const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 6) score += 20;
  if (password.length >= 8) score += 20;
  if (/[A-Z]/.test(password)) score += 20;
  if (/[0-9]/.test(password)) score += 20;
  if (/[^A-Za-z0-9]/.test(password)) score += 20;

  if (score < 40) return { score, label: "Weak", color: "bg-destructive" };
  if (score < 80) return { score, label: "Medium", color: "bg-warning" };
  return { score, label: "Strong", color: "bg-success" };
};

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Check if user is already authenticated on component mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/home', { replace: true });
      }
    };
    
    checkSession();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        navigate('/home', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Signup form
  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      aadharNumber: "",
      dlNumber: "",
      dlExpiry: "",
    },
  });

  // Helper function to upload document
  const uploadDocument = async (userId: string, docType: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${docType}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('agent-documents')
      .upload(fileName, file, { upsert: true });
      
    if (error) throw error;
    return data;
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      // Small delay to allow auth state to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check approval status
      const { data: profile } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('user_id', authData.user.id)
        .single();

      // Check approval status
      if (profile?.approval_status === 'pending') {
        navigate('/pending-approval');
        return;
      } else if (profile?.approval_status === 'rejected') {
        navigate('/pending-approval');
        return;
      }

      toast({
        title: "Login Successful",
        description: "Welcome back to Zaago!",
      });
      
      navigate('/home');
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSignupSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name,
            phone: data.phone,
          },
          emailRedirectTo: `${window.location.origin}/pending-approval`
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      const userId = authData.user.id;

      // Wait for session to be fully established
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify session is established
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Session not established. Please try again.");
      }
      
      console.log('Session established for user:', userId);

      // Step 2: Upload documents to storage
      const aadharFrontFile = data.aadharFront[0];
      const aadharBackFile = data.aadharBack[0];
      const dlFrontFile = data.dlFront[0];
      const dlBackFile = data.dlBack[0];
      const profilePhotoFile = data.profilePhoto[0];

      const uploadPromises = [
        uploadDocument(userId, 'aadhar-front', aadharFrontFile),
        uploadDocument(userId, 'aadhar-back', aadharBackFile),
        uploadDocument(userId, 'dl-front', dlFrontFile),
        uploadDocument(userId, 'dl-back', dlBackFile),
        uploadDocument(userId, 'profile-photo', profilePhotoFile),
      ];

      const uploadResults = await Promise.all(uploadPromises);

      // Step 3: Save document metadata to agent_documents table
      const { error: docError } = await supabase
        .from('agent_documents')
        .insert({
          user_id: userId,
          aadhar_number: data.aadharNumber,
          aadhar_front_url: uploadResults[0].path,
          aadhar_back_url: uploadResults[1].path,
          dl_number: data.dlNumber,
          dl_front_url: uploadResults[2].path,
          dl_back_url: uploadResults[3].path,
          dl_expiry_date: data.dlExpiry,
          profile_photo_url: uploadResults[4].path,
        });

      if (docError) throw docError;

      // Step 4: Update profile to mark documents submitted
      await supabase
        .from('profiles')
        .update({
          documents_submitted: true,
          submission_date: new Date().toISOString()
        })
        .eq('user_id', userId);

      toast({
        title: "Application Submitted",
        description: "Your documents are under review. You'll be notified once approved.",
      });
      
      // Redirect to pending approval page
      navigate('/pending-approval');
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
        errorMessage = "Session error. Please try signing up again.";
      } else if (error.message?.includes('storage')) {
        errorMessage = "Error uploading documents. Please check file sizes and try again.";
      }
      
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };


  const currentPassword = signupForm.watch("password");
  const passwordStrength = currentPassword ? getPasswordStrength(currentPassword) : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-dark">
      {/* Animated Header */}
      <div className="flex items-center space-x-4 mb-8 animate-fade-in">
        <div className="relative">
          <Truck className="w-10 h-10 text-primary glow-neon" />
          <div className="absolute inset-0 w-10 h-10 bg-primary/20 rounded-full animate-pulse" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider">
            Zaago Agent
          </h1>
          <p className="text-sm text-muted-foreground">Delivery Partner Platform</p>
        </div>
      </div>

      {/* Enhanced Login Card */}
      <Card className="w-full max-w-md glass border-primary/20 shadow-2xl animate-slide-up">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl text-foreground mb-2">
            {activeTab === "login" ? "Welcome Back" : "Join Zaago"}
          </CardTitle>
          <p className="text-muted-foreground">
            {activeTab === "login" ? "Sign in to start delivering" : "Create your delivery partner account"}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/20">
              <TabsTrigger 
                value="login" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="signup"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
              >
                Sign Up
              </TabsTrigger>
            </TabsList>
            
            {/* Login Form */}
            <TabsContent value="login" className="mt-6">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              type="email"
                              placeholder="Email address"
                              className="pl-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Password"
                              className="pl-10 pr-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit"
                    className="w-full bg-gradient-neon hover:shadow-neon hover:scale-105 transition-all duration-300 font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </Form>

              {/* Forgot Password */}
              <div className="text-center mt-4">
                <Button variant="link" className="text-primary hover:text-primary/80 text-sm">
                  Forgot Password?
                </Button>
              </div>
            </TabsContent>
            
            {/* Signup Form */}
            <TabsContent value="signup" className="mt-6">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              placeholder="Full name"
                              className="pl-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              type="email"
                              placeholder="Email address"
                              className="pl-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              placeholder="Phone number (10 digits)"
                              className="pl-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              type={showPassword ? "text" : "password"}
                              placeholder="Create password"
                              className="pl-10 pr-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                        
                        {/* Password Strength Indicator */}
                        {passwordStrength && currentPassword && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Password strength:</span>
                              <span className={`font-medium ${
                                passwordStrength.score < 40 ? 'text-destructive' : 
                                passwordStrength.score < 80 ? 'text-warning' : 'text-success'
                              }`}>
                                {passwordStrength.label}
                              </span>
                            </div>
                            <Progress 
                              value={passwordStrength.score} 
                              className="h-1"
                            />
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative group">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input 
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirm password"
                              className="pl-10 pr-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  {/* Document Section Divider */}
                  <div className="border-t border-border pt-4 mt-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Required Documents
                    </h3>
                  </div>

                  {/* Aadhar Card Number */}
                  <FormField
                    control={signupForm.control}
                    name="aadharNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Aadhar Card Number</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="Enter 12-digit Aadhar number"
                            maxLength={12}
                            className="bg-input/50 border-border focus:border-primary transition-all"
                          />
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Aadhar Front */}
                  <FormField
                    control={signupForm.control}
                    name="aadharFront"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Aadhar Card (Front)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => onChange(e.target.files)}
                              className="bg-input/50 border-border focus:border-primary transition-all file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-xs"
                            />
                            <Upload className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Aadhar Back */}
                  <FormField
                    control={signupForm.control}
                    name="aadharBack"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Aadhar Card (Back)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => onChange(e.target.files)}
                              className="bg-input/50 border-border focus:border-primary transition-all file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-xs"
                            />
                            <Upload className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Driving License Number */}
                  <FormField
                    control={signupForm.control}
                    name="dlNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Driving License Number</FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            placeholder="Enter DL number"
                            className="bg-input/50 border-border focus:border-primary transition-all"
                          />
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* DL Front */}
                  <FormField
                    control={signupForm.control}
                    name="dlFront"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Driving License (Front)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => onChange(e.target.files)}
                              className="bg-input/50 border-border focus:border-primary transition-all file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-xs"
                            />
                            <Upload className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* DL Back */}
                  <FormField
                    control={signupForm.control}
                    name="dlBack"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Driving License (Back)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field}
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => onChange(e.target.files)}
                              className="bg-input/50 border-border focus:border-primary transition-all file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-xs"
                            />
                            <Upload className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* DL Expiry Date */}
                  <FormField
                    control={signupForm.control}
                    name="dlExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">DL Expiry Date</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                              {...field}
                              type="date"
                              className="pl-10 bg-input/50 border-border focus:border-primary transition-all"
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Profile Photo */}
                  <FormField
                    control={signupForm.control}
                    name="profilePhoto"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Profile Photo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              {...field}
                              type="file"
                              accept="image/*"
                              onChange={(e) => onChange(e.target.files)}
                              className="bg-input/50 border-border focus:border-primary transition-all file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:text-xs"
                            />
                            <Upload className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-destructive text-xs" />
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="submit"
                    className="w-full bg-gradient-neon hover:shadow-neon hover:scale-105 transition-all duration-300 font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>

        </CardContent>
      </Card>
      
      {/* Enhanced Footer */}
      <div className="text-center mt-6 space-y-2 animate-fade-in">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Button variant="link" className="p-0 h-auto text-xs text-primary">
            Terms of Service
          </Button>
          {" "}and{" "}
          <Button variant="link" className="p-0 h-auto text-xs text-primary">
            Privacy Policy
          </Button>
        </p>
      </div>
    </div>
  );
};

export default Login;