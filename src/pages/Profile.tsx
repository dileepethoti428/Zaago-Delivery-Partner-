import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { LogOut, User, DollarSign, HelpCircle, ChevronRight, CheckCircle, Clock, MapPin, Loader2 } from 'lucide-react';
import { motion as m } from 'framer-motion';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { data: agentProfile, isLoading: loading } = useProfile(user?.email);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleSaveLocation = async () => {
    setIsSavingLocation(true);
    
    try {
      if (!navigator.geolocation) {
        toast({
          title: "Location not supported",
          description: "Your device doesn't support geolocation",
          variant: "destructive",
        });
        return;
      }

      // Helper function to get position with configurable options
      const getPosition = (highAccuracy: boolean, timeout: number): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: 60000, // Allow cached position up to 1 minute old
          });
        });
      };

      let position: GeolocationPosition;
      
      try {
        // First try: High accuracy with 20s timeout
        console.log('[Profile] Trying high accuracy GPS...');
        position = await getPosition(true, 20000);
      } catch (highAccuracyError) {
        console.log('[Profile] High accuracy failed, trying low accuracy...', highAccuracyError);
        
        // Fallback: Low accuracy (WiFi/cell) with 30s timeout
        toast({
          title: "Getting approximate location...",
          description: "GPS is slow, using network location",
        });
        
        position = await getPosition(false, 30000);
      }

      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      console.log('[Profile] Got location:', { latitude, longitude, accuracy });

      const { data, error } = await supabase.functions.invoke('update-agent-location', {
        body: {
          latitude,
          longitude,
          accuracy: accuracy ?? undefined,
          heading: heading ?? undefined,
          speed: speed ?? undefined,
        },
      });

      if (error) {
        toast({
          title: "Failed to save location",
          description: error.message || "Please try again",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Location saved successfully",
        description: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`,
      });
      
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        let message = "Unable to get location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission required. Please enable it in settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location unavailable. Please check your GPS.";
            break;
          case error.TIMEOUT:
            message = "Location request timed out. Please move to an open area and try again.";
            break;
        }
        
        toast({
          title: "Location error",
          description: message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to save location",
          variant: "destructive",
        });
      }
    } finally {
      setIsSavingLocation(false);
    }
  };

  const menuItems = [
    { icon: User, label: 'Edit Profile', action: () => navigate('/settings') },
    { icon: DollarSign, label: 'Payout Settings', action: () => navigate('/settings') },
    { icon: HelpCircle, label: 'Help & Support', action: () => console.log('Help') },
  ];

  return (
    <motion.div initial={pageTransition.initial} animate={pageTransition.animate} exit={pageTransition.exit} transition={pageTransitionConfig} className="h-full">
      <AppShell>
      <div className="space-y-6 py-4">
        <h1 className="text-2xl font-bold">Profile</h1>

        <Card className="rounded-2xl border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {agentProfile?.name ? agentProfile.name.split(' ').map(n => n[0]).join('') : 'DA'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="text-xl font-bold">{agentProfile?.name || user?.email || 'Delivery Agent'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-2">
                  {agentProfile?.is_active && (
                    <Badge className="gap-1" variant="default">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </Badge>
                  )}
                  {!agentProfile?.is_active && agentProfile && (
                    <Badge className="gap-1" variant="secondary">
                      <Clock className="h-3 w-3" />
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <p className="font-medium">Online Status</p>
                <p className="text-sm text-muted-foreground">Available for deliveries</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Button
          variant="default"
          className="w-full rounded-xl h-12 gap-2"
          onClick={handleSaveLocation}
          disabled={isSavingLocation}
        >
          {isSavingLocation ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving Location...
            </>
          ) : (
            <>
              <MapPin className="h-5 w-5" />
              Save My Location
            </>
          )}
        </Button>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <m.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </m.button>
              );
            })}
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full rounded-xl h-12 gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>
    </AppShell>
    </motion.div>
  );
}
