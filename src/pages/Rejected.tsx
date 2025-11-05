import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';

export default function Rejected() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthStore();

  const handleReapply = () => {
    navigate('/upload-documents');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
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
              <XCircle className="h-16 w-16 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl">Application Not Approved</CardTitle>
            <CardDescription>
              We couldn't approve your application at this time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {profile?.rejection_reason && (
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                <p className="text-sm font-medium mb-2">Reason:</p>
                <p className="text-sm text-muted-foreground">{profile.rejection_reason}</p>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleReapply}
                className="w-full rounded-xl h-11"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reapply with Correct Documents
              </Button>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full rounded-xl h-11"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Please ensure all documents are clear and valid before reapplying
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
