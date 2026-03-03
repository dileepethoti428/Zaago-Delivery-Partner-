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
import { LogOut, User, HelpCircle, ChevronRight, CheckCircle, Clock, MapPin, Loader2 } from 'lucide-react';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
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
  const { data: agentProfile, isLoading: loading } = useProfile(user?.email);
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

  const handleWhatsAppClick = () => {
    window.open('https://wa.me/917842343642', '_blank');
  };

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

      {/* Floating WhatsApp Button */}
      <button
        onClick={handleWhatsAppClick}
        className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#20BD5A] hover:scale-110 transition-all duration-200 flex items-center justify-center"
        aria-label="Chat on WhatsApp"
      >
        <WhatsAppIcon className="h-7 w-7" />
      </button>
    </AppShell>
    </motion.div>
  );
}
