import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Clock, XCircle, CheckCircle, RefreshCw } from "lucide-react";

interface ProfileData {
  approval_status: string;
  rejection_reason?: string;
  documents_submitted: boolean;
}

const PendingApproval = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }

        // Check if user is admin first
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        // If admin, redirect to home immediately
        if (roleData?.role === 'admin') {
          navigate('/home');
          return;
        }

        // Otherwise check approval status
        const { data } = await supabase
          .from('profiles')
          .select('approval_status, rejection_reason, documents_submitted')
          .eq('user_id', user.id)
          .single();

        setProfile(data);

        // If approved, redirect to home
        if (data?.approval_status === 'approved') {
          navigate('/home');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();

    // Subscribe to profile changes
    const subscribeToChanges = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
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
              const newProfile = payload.new as ProfileData;
              setProfile(newProfile);
              if (newProfile.approval_status === 'approved') {
                navigate('/home');
              }
            }
          )
          .subscribe();

        return channel;
      }
    };

    let channel: any;
    subscribeToChanges().then((ch) => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate]);

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Check admin role first
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData?.role === 'admin') {
        toast({
          title: "Access Granted",
          description: "You have admin privileges. Redirecting...",
        });
        navigate('/home');
        return;
      }

      // Fetch latest approval status from database
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('approval_status, rejection_reason, documents_submitted')
        .eq('user_id', user.id)
        .single();

      if (freshProfile) {
        setProfile(freshProfile);
        
        if (freshProfile.approval_status === 'approved') {
          toast({
            title: "Application Approved!",
            description: "Your account has been approved. Redirecting to home...",
          });
          navigate('/home');
        } else if (freshProfile.approval_status === 'pending') {
          toast({
            title: "Still Pending",
            description: "Your application is still under review.",
          });
        } else if (freshProfile.approval_status === 'rejected') {
          toast({
            title: "Application Status Updated",
            description: "Please review the rejection reason below.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast({
        title: "Refresh Failed",
        description: "Could not check status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-dark">
      <Card className="w-full max-w-md glass border-primary/20 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            {profile?.approval_status === 'pending' && (
              <div className="relative">
                <Clock className="w-16 h-16 text-warning animate-pulse" />
                <div className="absolute inset-0 w-16 h-16 bg-warning/20 rounded-full animate-ping" />
              </div>
            )}
            {profile?.approval_status === 'rejected' && (
              <XCircle className="w-16 h-16 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl text-foreground">
            {profile?.approval_status === 'pending' ? 'Application Under Review' : 'Application Rejected'}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {profile?.approval_status === 'pending' && (
            <>
              <div className="text-center space-y-3">
                <p className="text-muted-foreground">
                  Your documents are being verified by our team.
                </p>
                <p className="text-sm text-muted-foreground">
                  This usually takes 24-48 hours. You'll receive an email once your application is approved.
                </p>
              </div>
              
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2 text-foreground">Documents Submitted:</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Aadhar Card
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Driving License
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    Profile Photo
                  </li>
                </ul>
              </div>

              <Button 
                onClick={handleRefreshStatus}
                variant="outline"
                className="w-full border-primary/20 hover:bg-primary/10"
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking Status...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Check Status
                  </>
                )}
              </Button>
            </>
          )}

          {profile?.approval_status === 'rejected' && (
            <>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2 text-destructive">Rejection Reason:</h3>
                <p className="text-sm text-muted-foreground">
                  {profile.rejection_reason || 'Please contact support for more information.'}
                </p>
              </div>
              
              <Button 
                onClick={() => navigate('/login')}
                className="w-full bg-primary hover:bg-primary/90"
              >
                Resubmit Application
              </Button>
            </>
          )}

          <Button 
            onClick={handleSignOut}
            variant="outline"
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
