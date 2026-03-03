import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { pageTransition, pageTransitionConfig } from '@/animation/variants';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { LogOut, User, HelpCircle, ChevronRight, CheckCircle, Clock, MapPin, Loader2, MessageCircle } from 'lucide-react';
import { Browser } from '@capacitor/browser';

import { motion as m } from 'framer-motion';
import { useProfileById } from '@/hooks/useProfile';
import { useAgentSettings } from '@/hooks/useSettings';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { checkLocationPermission } from '@/utils/checkLocationPermission';
import { useQueryClient } from '@tanstack/react-query';
import { useResumeGuard } from '@/hooks/useResumeGuard';

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const { data: agentProfile, isLoading: loading } = useProfileById(user?.id);
  const { data: agentSettingsData } = useAgentSettings();
  const lastKnown = useLocationStore((state) => state.lastKnown);
  const startWatch = useLocationStore((state) => state.startWatch);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isTogglingOnline, setIsTogglingOnline] = useState(false);

  // Reset stuck loading states when returning from external apps (Maps, Phone, etc.)
  useResumeGuard(() => {
    setIsSavingLocation(false);
    setIsTogglingOnline(false);
  });

  // Initialize online status from agent settings
  useEffect(() => {
    if (agentSettingsData?.settings?.is_available !== undefined) {
      setIsOnline(agentSettingsData.settings.is_available);
    } else if (agentProfile?.is_online !== undefined) {
      setIsOnline(agentProfile.is_online);
    }
  }, [agentSettingsData, agentProfile]);

  const handleOnlineToggle = async (checked: boolean) => {
    // If trying to go online, check location permission first
    if (checked) {
      const hasPermission = await checkLocationPermission();
      
      if (!hasPermission) {
        toast({
          title: "Location Required",
          description: "Please allow location permission to go online",
          variant: "destructive",
        });
        return;
      }
      
      // Start location tracking when going online
      await startWatch();
    }
    
    setIsTogglingOnline(true);
    
    try {
      const { error } = await supabase.functions.invoke('update-agent-preferences', {
        body: { is_available: checked },
      });
      
      if (error) throw error;
      
      setIsOnline(checked);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
      
      toast({
        title: checked ? "You're Online!" : "You're Offline",
        description: checked 
          ? "You'll now receive delivery orders" 
          : "You won't receive new orders",
      });
    } catch (err) {
      console.error('[Profile] Failed to update online status:', err);
      toast({
        title: "Failed to update status",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsTogglingOnline(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleSaveLocation = async () => {
    setIsSavingLocation(true);
    
    try {
      // Use already-tracked location from the store
      if (!lastKnown) {
        toast({
          title: "No location available",
          description: "Please enable location services and wait for GPS to update",
          variant: "destructive",
        });
        return;
      }

      console.log('[Profile] Using tracked location:', lastKnown);

      const { data, error } = await supabase.functions.invoke('update-agent-location', {
        body: {
          latitude: lastKnown.lat,
          longitude: lastKnown.lng,
          accuracy: lastKnown.accuracy ?? undefined,
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
        description: `Lat: ${lastKnown.lat.toFixed(4)}, Lng: ${lastKnown.lng.toFixed(4)}`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save location",
        variant: "destructive",
      });
    } finally {
      setIsSavingLocation(false);
    }
  };

  const menuItems = [
    { icon: User, label: 'Edit Profile', action: () => navigate('/settings') },
    { icon: HelpCircle, label: 'Help & Support', action: () => navigate('/help') },
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
                <AvatarImage
                  src={agentProfile?.profile_image || undefined}
                  alt={agentProfile?.name || 'Agent'}
                />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {agentProfile?.name ? agentProfile.name.split(' ').map(n => n[0]).join('') : 'DA'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="text-xl font-bold">{agentProfile?.name || user?.email || 'Delivery Partner'}</h2>
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
                <p className="text-sm text-muted-foreground">
                  {isOnline ? 'Receiving orders' : 'Not receiving orders'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isTogglingOnline && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch 
                  checked={isOnline} 
                  onCheckedChange={handleOnlineToggle}
                  disabled={isTogglingOnline}
                />
              </div>
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

      {/* Floating Call Support Button */}
      <button
        onClick={() => { window.location.href = 'tel:+917842343642'; }}
        className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-all duration-200 flex items-center justify-center"
        aria-label="Call Support"
      >
        <Phone className="h-6 w-6" />
      </button>
    </AppShell>
    </motion.div>
  );
}
