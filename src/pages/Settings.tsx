import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAudioNotification, RingtoneSettings } from "@/hooks/useAudioNotification";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { 
  Bell, 
  Shield, 
  User, 
  Smartphone, 
  MapPin, 
  HelpCircle,
  LogOut,
  ChevronRight,
  Volume2,
  Vibrate,
  Moon,
  Globe,
  Truck,
  CreditCard,
  Star,
  Edit,
  Save,
  X,
  Palette,
  MessageCircle,
  Play
} from "lucide-react";

const getRingtoneDescription = (type: string) => {
  switch (type) {
    case 'phone-ringtone':
      return 'Traditional phone ringing sound';
    case 'notification-sound':
      return 'Standard notification tone';
    case 'iphone-notification':
      return 'iPhone-style notification sound';
    case 'samsung-notification':
      return 'Samsung-style notification sound';
    case 'android-notification':
      return 'Android-style notification sound';
    case 'classic-bell':
      return 'Classic bell ringing sound';
    case 'chimes-notification':
      return 'Melodic chimes notification';
    default:
      return 'Phone ringtone';
  }
};

const Settings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalSettings, setOriginalSettings] = useState({
    push_notifications: true,
    sound_alerts: true,
    vibration: false,
    location_services: true,
    ringtone_enabled: true,
    ringtone_volume: 0.8,
    ringtone_type: 'phone-ringtone',
    notification_frequency: 'double',
    personal_info: {
      name: '',
      phone: '',
      email: '',
      vehicle: 'Honda Civic 2020'
    }
  });
  const [settings, setSettings] = useState({
    push_notifications: true,
    sound_alerts: true,
    vibration: false,
    location_services: true,
    ringtone_enabled: true,
    ringtone_volume: 1.0, // Maximum volume for iPhone ringtone
    ringtone_type: 'iphone-ringtone', // Default to iPhone ringtone
    notification_frequency: 'double',
    personal_info: {
      name: '',
      phone: '',
      email: '',
      vehicle: 'Honda Civic 2020'
    }
  });

  // Continuous ringing settings
  const [continuousRingingEnabled, setContinuousRingingEnabled] = useState(false);
  const [maxRepetitions, setMaxRepetitions] = useState(12); // Default 12 repetitions (1 minute)

  // Update notification systems to use the settings
  const updatedRingtoneSettings: RingtoneSettings = {
    enabled: settings.ringtone_enabled,
    volume: settings.ringtone_volume,
    type: settings.ringtone_type,
    frequency: settings.notification_frequency
  };
  
  const { testRingtone } = useAudioNotification(updatedRingtoneSettings);

  // Test continuous ringing function
  const testContinuousRinging = () => {
    if (!settings.ringtone_enabled) return;
    
    const interval = setInterval(() => {
      testRingtone();
    }, 300); // Ring every 300ms for urgency
    
    // Stop after 15 seconds (test duration)
    setTimeout(() => {
      clearInterval(interval);
      toast({
        title: "Test Complete",
        description: "15-second continuous ringing test finished.",
      });
    }, 15000);
    
    toast({
      title: "Testing Continuous Ringing",
      description: "Playing 15-second continuous ringing pattern...",
    });
  };

  useEffect(() => {
    fetchAgentSettings();
  }, []);

  const fetchAgentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent details
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id, name, phone, email')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent) {
        setAgentId(agent.id);
        
        // Get agent settings
        const { data: agentSettings } = await supabase
          .from('agent_settings')
          .select('*')
          .eq('agent_id', agent.id)
          .maybeSingle();

        if (agentSettings) {
          const newSettings = {
            push_notifications: agentSettings.push_notifications,
            sound_alerts: agentSettings.sound_alerts,
            vibration: agentSettings.vibration,
            location_services: agentSettings.location_services,
            ringtone_enabled: agentSettings.ringtone_enabled ?? true,
            ringtone_volume: agentSettings.ringtone_volume ?? 1.0, // Maximum default volume
            ringtone_type: agentSettings.ringtone_type ?? 'iphone-ringtone', // Default to iPhone
            notification_frequency: agentSettings.notification_frequency ?? 'double',
            personal_info: {
              name: agent.name || '',
              phone: agent.phone || '',
              email: agent.email || '',
              vehicle: (agentSettings.vehicle_info as any)?.model || 'Honda Civic 2020'
            }
          };
          setSettings(newSettings);
          setOriginalSettings(newSettings);
        } else {
          // Set default with agent info
          const defaultSettings = {
            push_notifications: true,
            sound_alerts: true,
            vibration: false,
            location_services: true,
            ringtone_enabled: true,
            ringtone_volume: 1.0, // Maximum default volume
            ringtone_type: 'iphone-ringtone', // Default to iPhone
            notification_frequency: 'double',
            personal_info: {
              name: agent.name || '',
              phone: agent.phone || '',
              email: agent.email || '',
              vehicle: 'Honda Civic 2020'
            }
          };
          setSettings(defaultSettings);
          setOriginalSettings(defaultSettings);
        }
      }
    } catch (error) {
      console.error('Error fetching agent settings:', error);
    }
  };

  const updateSetting = async (key: string, value: boolean | number | string) => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('agent_settings')
        .upsert({
          agent_id: agentId,
          [key]: value
        }, {
          onConflict: 'agent_id'
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved.",
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const savePersonalInfo = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      // Update agent basic info
      const { error: agentError } = await supabase
        .from('delivery_agents')
        .update({
          name: settings.personal_info.name,
          phone: settings.personal_info.phone
        })
        .eq('id', agentId);

      if (agentError) throw agentError;

      // Update agent settings with vehicle info
      const { error: settingsError } = await supabase
        .from('agent_settings')
        .upsert({
          agent_id: agentId,
          personal_info: settings.personal_info,
          vehicle_info: { model: settings.personal_info.vehicle }
        }, {
          onConflict: 'agent_id'
        });

      if (settingsError) throw settingsError;

      setShowEditDialog(false);
      toast({
        title: "Profile Updated",
        description: "Your personal information has been saved.",
      });
    } catch (error) {
      console.error('Error saving personal info:', error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleEditToggle = () => {
    if (isEditMode) {
      // Cancel edit mode - restore original settings
      setSettings(originalSettings);
      setIsEditMode(false);
    } else {
      // Enter edit mode - save current settings as original
      setOriginalSettings({ ...settings });
      setIsEditMode(true);
    }
  };

  const handleSaveAll = async () => {
    if (!agentId) {
      toast({
        title: "Error",
        description: "Agent ID not found. Please try refreshing the page.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Update agent basic info
      const { error: agentError } = await supabase
        .from('delivery_agents')
        .update({
          name: settings.personal_info.name,
          phone: settings.personal_info.phone
        })
        .eq('id', agentId);

      if (agentError) {
        console.error('Agent update error:', agentError);
        throw agentError;
      }

      // Update agent settings
      const { error: settingsError } = await supabase
        .from('agent_settings')
        .upsert({
          agent_id: agentId,
          push_notifications: settings.push_notifications,
          sound_alerts: settings.sound_alerts,
          vibration: settings.vibration,
          location_services: settings.location_services,
          personal_info: settings.personal_info,
          vehicle_info: { model: settings.personal_info.vehicle }
        }, {
          onConflict: 'agent_id'
        });

      if (settingsError) {
        console.error('Settings update error:', settingsError);
        throw settingsError;
      }

      // Update original settings to reflect saved state
      setOriginalSettings({ ...settings });
      setIsEditMode(false);
      
      toast({
        title: "Settings Saved",
        description: "All your settings have been updated successfully.",
      });
      // Update notification systems to use the new settings
      const updatedRingtoneSettings: RingtoneSettings = {
        enabled: settings.ringtone_enabled,
        volume: settings.ringtone_volume,
        type: settings.ringtone_type,
        frequency: settings.notification_frequency
      };
      
      // Refresh data to ensure UI is in sync
      await fetchAgentSettings();
      
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: `Failed to save settings: ${error.message || 'Please try again.'}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNavigation = (item: any) => {
    if (isEditMode) return; // Disable navigation in edit mode
    
    switch (item.title) {
      case "Personal Information":
        setShowEditDialog(true);
        break;
      case "Privacy & Security":
        navigate('/privacy-security');
        break;
      case "Help Center":
        navigate('/help');
        break;
      case "Contact Support":
        window.open('https://wa.me/917842343642', '_blank');
        break;
      default:
        toast({
          title: "Coming Soon",
          description: `${item.title} feature is coming soon!`,
        });
    }
  };

  const settingsGroups = [
    {
      title: "Account",
      items: [
        {
          icon: User,
          title: "Personal Information",
          description: "Update your profile details",
          action: "navigate",
          color: "text-primary"
        },
        {
          icon: Shield,
          title: "Privacy & Security",
          description: "Manage your privacy settings",
          action: "navigate",
          color: "text-primary"
        },
        {
          icon: CreditCard,
          title: "Help Center",
          description: "Get help and support",
          action: "navigate",
          color: "text-primary"
        }
      ]
    },
    {
      title: "App Preferences",
      items: [
        {
          icon: Bell,
          title: "Notifications",
          description: "Push notifications enabled",
          action: "toggle",
          color: "text-primary",
          enabled: settings.push_notifications,
          key: "push_notifications"
        },
        {
          icon: Volume2,
          title: "Sound Alerts",
          description: "Play sounds for new orders",
          action: "toggle",
          color: "text-primary",
          enabled: settings.sound_alerts,
          key: "sound_alerts"
        },
        {
          icon: Vibrate,
          title: "Vibration",
          description: "Vibrate on new notifications",
          action: "toggle",
          color: "text-primary",
          enabled: settings.vibration,
          key: "vibration"
        },
        {
          icon: MapPin,
          title: "Location Services",
          description: "Always track location",
          action: "toggle",
          color: "text-primary",
          enabled: settings.location_services,
          key: "location_services"
        },
        {
          icon: Palette,
          title: "Theme",
          description: `${theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'} theme`,
          action: "theme",
          color: "text-primary",
          theme: theme
        }
      ]
    },
    {
      title: "iPhone Ringtone Settings",
      items: [],
      customRender: true
    },
    {
      title: "Delivery Settings",
      items: [
        {
          icon: Truck,
          title: "Vehicle Information",
          description: settings.personal_info.vehicle,
          action: "navigate",
          color: "text-primary"
        },
        {
          icon: MapPin,
          title: "Preferred Areas",
          description: "Set your delivery zones",
          action: "navigate",
          color: "text-primary"
        },
        {
          icon: Globe,
          title: "Language",
          description: "English (US)",
          action: "navigate",
          color: "text-primary"
        }
      ]
    },
    {
      title: "Support & Feedback",
      items: [
        {
          icon: Star,
          title: "Rate the App",
          description: "Share your feedback",
          action: "navigate",
          color: "text-primary"
        },
        {
          icon: Smartphone,
          title: "Contact Support",
          description: "Get help from our team",
          action: "navigate",
          color: "text-primary"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Edit your settings" : "Customize your app experience"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleEditToggle}
          className="h-10 w-10"
        >
          {isEditMode ? (
            <X className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Edit className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Settings Groups */}
      <div className="space-y-6 animate-slide-up">
        {settingsGroups.map((group, groupIndex) => (
          <Card key={groupIndex} className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.customRender && group.title === "iPhone Ringtone Settings" ? (
                <div className="space-y-6 p-4">
                  {/* Master Enable/Disable Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Volume2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Enable iPhone Ringtones</p>
                        <p className="text-sm text-muted-foreground">Master switch for iPhone-style notification sounds</p>
                      </div>
                    </div>
                    <Switch 
                      checked={settings.ringtone_enabled}
                      onCheckedChange={(checked) => {
                        if (isEditMode) {
                          setSettings(prev => ({ ...prev, ringtone_enabled: checked }));
                        } else {
                          updateSetting('ringtone_enabled', checked);
                        }
                      }}
                      disabled={loading}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>

                  {/* Volume Control */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Volume2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Volume: {Math.round(settings.ringtone_volume * 100)}%</p>
                          <p className="text-sm text-muted-foreground">Adjust ringtone volume level</p>
                        </div>
                      </div>
                    </div>
                    <Slider
                      value={[settings.ringtone_volume * 100]}
                      onValueChange={(values) => {
                        const volume = values[0] / 100;
                        if (isEditMode) {
                          setSettings(prev => ({ ...prev, ringtone_volume: volume }));
                        } else {
                          updateSetting('ringtone_volume', volume);
                        }
                      }}
                      max={100}
                      step={5}
                      className="w-full"
                      disabled={!settings.ringtone_enabled}
                    />
                  </div>

                  {/* Test Rapido Ringtone */}
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-foreground">New Order Ringtone: iPhone Style</p>
                      <p className="text-sm text-muted-foreground">Classic iPhone ringtone with maximum volume for urgent notifications</p>
                    </div>
                    <Button
                      onClick={() => testRingtone()}
                      disabled={!settings.ringtone_enabled}
                      className="w-full bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-200"
                      variant="outline"
                    >
                      🔔 Test iPhone Ringtone
                    </Button>
                  </div>

                  {/* Continuous Ringing Settings */}
                  <div className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">Continuous Ringing (iPhone Style)</p>
                        <p className="text-sm text-muted-foreground">Ring continuously until you respond to new orders (iPhone style)</p>
                      </div>
                      <Switch 
                        checked={continuousRingingEnabled}
                        onCheckedChange={setContinuousRingingEnabled}
                        disabled={!settings.ringtone_enabled}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>

                    {continuousRingingEnabled && (
                      <>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium text-foreground">Max Repetitions: {maxRepetitions} ({Math.round(maxRepetitions * 5 / 60)} minutes)</p>
                            <p className="text-sm text-muted-foreground">Maximum number of times to repeat before auto-stopping</p>
                          </div>
                          <Slider
                            value={[maxRepetitions]}
                            onValueChange={(values) => setMaxRepetitions(values[0])}
                            min={6}
                            max={48}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        <Button
                          onClick={testContinuousRinging}
                          disabled={!settings.ringtone_enabled}
                          variant="outline"
                          className="w-full"
                        >
                          🧪 Test Continuous Ringing (15s)
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                group.items.map((item, itemIndex) => {
                  const IconComponent = item.icon;
                  return (
                  <div
                    key={itemIndex}
                    className={`flex items-center justify-between p-3 rounded-lg transition-smooth ${
                      !isEditMode && item.action === "navigate" 
                        ? "hover:bg-secondary/50 cursor-pointer" 
                        : ""
                    }`}
                    onClick={() => !isEditMode && item.action === "navigate" && handleNavigation(item)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{item.title}</p>
                        {item.title === "Personal Information" && isEditMode ? (
                          <div className="space-y-2 mt-2">
                            <Input
                              value={settings.personal_info.name}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                personal_info: { ...prev.personal_info, name: e.target.value }
                              }))}
                              placeholder="Full Name"
                              className="h-8"
                            />
                            <Input
                              value={settings.personal_info.phone}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                personal_info: { ...prev.personal_info, phone: e.target.value }
                              }))}
                              placeholder="Phone Number"
                              className="h-8"
                            />
                          </div>
        ) : item.title === "Vehicle Information" && isEditMode ? (
                          <Input
                            value={settings.personal_info.vehicle}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              personal_info: { ...prev.personal_info, vehicle: e.target.value }
                            }))}
                            placeholder="Vehicle Information"
                            className="h-8 mt-2"
                          />
                        ) : item.action === "ringtone_volume" && !isEditMode ? (
                          <div className="mt-2">
                            <div className="text-sm text-muted-foreground mb-1">Volume: {Math.round(settings.ringtone_volume * 100)}%</div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                    </div>
                    
                    {item.action === "toggle" ? (
                      <Switch 
                        checked={item.enabled}
                        onCheckedChange={(checked) => {
                          if (isEditMode) {
                            setSettings(prev => ({ ...prev, [item.key]: checked }));
                          } else {
                            updateSetting(item.key, checked);
                          }
                        }}
                        disabled={loading}
                        className="data-[state=checked]:bg-primary"
                      />
                    ) : item.action === "ringtone_volume" ? (
                      <div className="w-32">
                        <Slider
                          value={[settings.ringtone_volume * 100]}
                          onValueChange={(values) => {
                            const volume = values[0] / 100;
                            if (isEditMode) {
                              setSettings(prev => ({ ...prev, ringtone_volume: volume }));
                            } else {
                              updateSetting('ringtone_volume', volume);
                            }
                          }}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                      </div>
                    ) : item.action === "ringtone_type" ? (
                      <Select 
                        value={settings.ringtone_type} 
                        onValueChange={(value) => {
                          if (isEditMode) {
                            setSettings(prev => ({ ...prev, ringtone_type: value }));
                          } else {
                            updateSetting('ringtone_type', value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="phone-ringtone">Classic Phone Ring</SelectItem>
                           <SelectItem value="notification-sound">Default Notification</SelectItem>
                           <SelectItem value="iphone-notification">iPhone Style</SelectItem>
                           <SelectItem value="samsung-notification">Samsung Style</SelectItem>
                           <SelectItem value="android-notification">Android Style</SelectItem>
                           <SelectItem value="classic-bell">Classic Bell</SelectItem>
                           <SelectItem value="chimes-notification">Chimes</SelectItem>
                         </SelectContent>
                      </Select>
                    ) : item.action === "notification_pattern" ? (
                      <Select 
                        value={settings.notification_frequency} 
                        onValueChange={(value) => {
                          if (isEditMode) {
                            setSettings(prev => ({ ...prev, notification_frequency: value }));
                          } else {
                            updateSetting('notification_frequency', value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single</SelectItem>
                          <SelectItem value="double">Double</SelectItem>
                          <SelectItem value="continuous">Continuous</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : item.action === "test_ringtone" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testRingtone()}
                        disabled={!settings.ringtone_enabled}
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Test
                      </Button>
                    ) : item.action === "theme" ? (
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : !isEditMode ? (
                      <ChevronRight 
                        className="w-5 h-5 text-muted-foreground" 
                        onClick={() => handleNavigation(item)}
                      />
                    ) : null}
                  </div>
                 );
                })
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* App Information */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-4">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <Truck className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Zaago Delivery Agent</h3>
            <p className="text-sm text-muted-foreground">Version 1.0.0</p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button - Only show in edit mode */}
      {isEditMode && (
        <Card className="bg-card border-border animate-slide-up">
          <CardContent className="p-4">
            <Button 
              onClick={handleSaveAll}
              disabled={loading}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              Save All Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      {!isEditMode && (
        <Card className="bg-card border-destructive/20 animate-slide-up">
          <CardContent className="p-4">
            <Button 
              variant="outline" 
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleSignOut}
              disabled={loading}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Personal Information Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Personal Information</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={settings.personal_info.name}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  personal_info: { ...prev.personal_info, name: e.target.value }
                }))}
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings.personal_info.phone}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  personal_info: { ...prev.personal_info, phone: e.target.value }
                }))}
                placeholder="Enter your phone number"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={settings.personal_info.email}
                disabled
                placeholder="Email cannot be changed"
              />
            </div>
            <div>
              <Label htmlFor="vehicle">Vehicle Information</Label>
              <Input
                id="vehicle"
                value={settings.personal_info.vehicle}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  personal_info: { ...prev.personal_info, vehicle: e.target.value }
                }))}
                placeholder="e.g., Honda Civic 2020"
              />
            </div>
            <Button 
              onClick={savePersonalInfo} 
              disabled={loading}
              className="w-full"
            >
              <Edit className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating WhatsApp Button */}
      <Button
        onClick={() => window.open('https://wa.me/917842343642', '_blank')}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-success hover:bg-success/90 text-white shadow-lg hover:shadow-xl transition-all duration-300 z-50"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    </div>
  );
};

export default Settings;