import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/app';

export default function Login() {
  const navigate = useNavigate();
  const { setIsAuthed, setAgent } = useAppStore();
  const [email, setEmail] = useState('agent@zaago.com');
  const [password, setPassword] = useState('password');

  const handleSignIn = () => {
    setIsAuthed(true);
    setAgent({
      id: 'agent-001',
      name: 'John Doe',
      email: email,
    });
    navigate('/home');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="p-4 bg-primary rounded-2xl shadow-lg">
            <Truck className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Zaago Delivery Agent</h1>
        </div>

        <Card className="rounded-2xl shadow-xl border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your delivery agent account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@zaago.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <Button 
              onClick={handleSignIn}
              className="w-full rounded-xl h-11 text-base font-medium"
            >
              Sign in
            </Button>

            <div className="flex justify-between text-sm">
              <button className="text-primary hover:underline">
                Forgot password?
              </button>
              <button className="text-primary hover:underline">
                Create account
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
