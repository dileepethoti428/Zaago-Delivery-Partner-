import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldOff, LogOut, MessageCircle, Mail } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';

export default function Deactivated() {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="rounded-2xl shadow-xl border-0 bg-card/50 backdrop-blur">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mx-auto p-6 bg-destructive/10 rounded-2xl mb-4"
            >
              <ShieldOff className="h-16 w-16 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl">Account Deactivated</CardTitle>
            <CardDescription>
              Your delivery partner account has been deactivated by the administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 border border-border rounded-xl">
              <p className="text-sm text-muted-foreground text-center">
                You cannot access the app until your account is reactivated. Please contact support for more information.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => Browser.open({ url: 'https://wa.me/917842343642' })}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-primary-foreground font-medium transition-colors hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Us
                </button>
                <button
                  onClick={() => Browser.open({ url: 'mailto:helpzaago@gmail.com' })}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-muted text-foreground font-medium transition-colors hover:bg-muted/70"
                >
                  <Mail className="h-4 w-4" />
                  Email Us
                </button>
              </div>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full rounded-xl h-11"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              If you believe this is a mistake, please reach out to our support team
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
