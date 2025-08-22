import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Mail, Lock, User, Truck } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      navigate('/home');
    }, 2000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-dark">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-8 animate-fade-in">
        <Truck className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Zaago Agent</h1>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md glass border-border animate-slide-up">
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-foreground">Welcome Back</CardTitle>
          <p className="text-muted-foreground">Sign in to start delivering</p>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4 mt-6">
              <div className="space-y-2">
                <div className="relative">
                  <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Phone number" 
                    className="pl-10 bg-input border-border"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    className="pl-10 bg-input border-border"
                  />
                </div>
              </div>
              
              <Button 
                onClick={handleLogin} 
                className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4 mt-6">
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Full name" 
                  className="pl-10 bg-input border-border"
                />
              </div>
              
              <div className="relative">
                <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Phone number" 
                  className="pl-10 bg-input border-border"
                />
              </div>
              
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="email" 
                  placeholder="Email address" 
                  className="pl-10 bg-input border-border"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="password" 
                  placeholder="Create password" 
                  className="pl-10 bg-input border-border"
                />
              </div>
              
              <Button 
                onClick={handleLogin} 
                className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Sign Up"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Footer */}
      <p className="text-center text-sm text-muted-foreground mt-6 animate-fade-in">
        By continuing, you agree to our Terms & Privacy Policy
      </p>
    </div>
  );
};

export default Login;