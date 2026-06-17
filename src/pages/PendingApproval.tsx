import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, FileCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuthStore();

  // Real-time listener for approval status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.approval_status;
          if (newStatus === 'approved') {
            toast({
              title: 'Account Approved! 🎉',
              description: 'Your account has been approved. Welcome to Zaago!',
            });
            navigate('/home');
          } else if (newStatus === 'rejected') {
            toast({
              title: 'Application Update',
              description: 'Please check your application status',
              variant: 'destructive',
            });
            navigate('/rejected');
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, navigate]);

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
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
              className="mx-auto p-6 bg-primary/10 rounded-2xl mb-4"
            >
              <Clock className="h-16 w-16 text-primary" />
            </motion.div>
            <CardTitle className="text-2xl">Under Review</CardTitle>
            <CardDescription>
              Your documents are being reviewed by our team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl">
                <FileCheck className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Documents Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    {profile?.submission_date
                      ? new Date(profile.submission_date).toLocaleDateString()
                      : 'Recently'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-sm text-center text-muted-foreground">
                  This usually takes 24-48 hours. You'll be notified once your account is approved.
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-11"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign Out?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to sign out?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    className={buttonVariants({ variant: 'destructive' })}
                  >
                    Sign Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
