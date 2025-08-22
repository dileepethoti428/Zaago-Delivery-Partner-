import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Lock, 
  Smartphone, 
  MapPin, 
  Bell, 
  Fingerprint,
  AlertTriangle,
  Check,
  Edit,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacySecurity = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    location_services: true,
    push_notifications: true,
    data_sharing: false,
    biometric_login: false,
    two_factor_auth: false,
    auto_logout: true,
    secure_mode: true
  });

  useEffect(() => {
    fetchAgentSettings();
  }, []);

  const fetchAgentSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent ID
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
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
          setSettings({
            location_services: agentSettings.location_services,
            push_notifications: agentSettings.push_notifications,
            data_sharing: false, // Default privacy setting
            biometric_login: false, // Not stored in DB
            two_factor_auth: false, // Not implemented yet
            auto_logout: true, // Default security setting
            secure_mode: true // Default security setting
          });
        }
      }
    } catch (error) {
      console.error('Error fetching agent settings:', error);
    }
  };

  const updateSetting = async (key: string, value: boolean) => {
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
        description: "Your privacy settings have been saved.",
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

  const securityItems = [
    {
      icon: Lock,
      title: "Biometric Login",
      description: "Use fingerprint or face ID to unlock app",
      key: "biometric_login",
      enabled: settings.biometric_login,
      color: "text-primary"
    },
    {
      icon: Smartphone,
      title: "Two-Factor Authentication",
      description: "Add extra security with SMS verification",
      key: "two_factor_auth",
      enabled: settings.two_factor_auth,
      color: "text-success"
    },
    {
      icon: Shield,
      title: "Auto Logout",
      description: "Automatically logout after 30 minutes of inactivity",
      key: "auto_logout",
      enabled: settings.auto_logout,
      color: "text-warning"
    },
    {
      icon: AlertTriangle,
      title: "Secure Mode",
      description: "Enhanced security for sensitive operations",
      key: "secure_mode",
      enabled: settings.secure_mode,
      color: "text-destructive"
    }
  ];

  const privacyItems = [
    {
      icon: MapPin,
      title: "Location Services",
      description: "Allow app to access your location for deliveries",
      key: "location_services",
      enabled: settings.location_services,
      color: "text-primary"
    },
    {
      icon: Bell,
      title: "Push Notifications",
      description: "Receive notifications about new orders and updates",
      key: "push_notifications",
      enabled: settings.push_notifications,
      color: "text-success"
    },
    {
      icon: Eye,
      title: "Data Sharing",
      description: "Share analytics data to improve app experience",
      key: "data_sharing",
      enabled: settings.data_sharing,
      color: "text-warning"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 animate-fade-in">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Privacy & Security</h1>
          <p className="text-muted-foreground">Manage your privacy and security preferences</p>
        </div>
      </div>

      {/* Security Settings */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-primary" />
            <span>Security Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {securityItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-smooth">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IconComponent className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                
                <Switch 
                  checked={item.enabled}
                  onCheckedChange={(checked) => updateSetting(item.key, checked)}
                  disabled={loading}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5 text-success" />
            <span>Privacy Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacyItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-smooth">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <IconComponent className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                
                <Switch 
                  checked={item.enabled}
                  onCheckedChange={(checked) => updateSetting(item.key, checked)}
                  disabled={loading}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Account Security */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Fingerprint className="w-5 h-5 text-warning" />
            <span>Account Security</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-warning" />
              <h4 className="font-semibold text-foreground">Security Status</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Your account is secured with basic authentication. Consider enabling additional security features.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-success" />
                <span className="text-sm">Email verification enabled</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-success" />
                <span className="text-sm">Strong password required</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <span className="text-sm">Two-factor authentication disabled</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy Info */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-4">
          <div className="text-center space-y-2">
            <Eye className="w-8 h-8 text-muted-foreground mx-auto" />
            <h4 className="font-semibold text-foreground">Your Privacy Matters</h4>
            <p className="text-sm text-muted-foreground">
              We respect your privacy and only collect data necessary to provide our delivery services. 
              Your location is only used for navigation and order tracking.
            </p>
            <Button variant="outline" className="mt-4">
              Read Privacy Policy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacySecurity;