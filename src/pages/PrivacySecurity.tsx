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
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="mt-4">
                  Read Privacy Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Privacy Policy - Zaago Delivery Partners</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 text-sm">
                  <div>
                    <h3 className="font-semibold text-base mb-2">Information We Collect</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Personal Information:</strong> Name, phone number, email address, profile photo, government ID details, bank account information for payouts.</p>
                      <p><strong>Location Data:</strong> Real-time GPS location during delivery hours to optimize order assignments and provide navigation assistance.</p>
                      <p><strong>Device Information:</strong> Device type, operating system, app version, unique device identifiers for security and optimization.</p>
                      <p><strong>Financial Data:</strong> Earnings, transaction history, payment methods, and payout preferences.</p>
                      <p><strong>Performance Data:</strong> Delivery ratings, completion times, acceptance rates, and service quality metrics.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">How We Use Your Information</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Service Delivery:</strong> Match you with nearby delivery opportunities, provide turn-by-turn navigation, and facilitate order completion.</p>
                      <p><strong>Payment Processing:</strong> Calculate earnings, process payouts, maintain transaction records, and provide financial summaries.</p>
                      <p><strong>Safety & Security:</strong> Verify your identity, prevent fraud, ensure platform safety, and maintain service quality.</p>
                      <p><strong>Communication:</strong> Send order notifications, service updates, promotional offers, and support communications.</p>
                      <p><strong>Analytics & Improvement:</strong> Analyze performance metrics, optimize delivery routes, and enhance app functionality.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Information Sharing</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>With Customers:</strong> Your name, photo, real-time location (during active deliveries), and contact information for delivery coordination.</p>
                      <p><strong>With Merchants:</strong> Basic profile information and delivery status updates for order fulfillment.</p>
                      <p><strong>Service Providers:</strong> Payment processors, mapping services, background check providers, and cloud infrastructure partners.</p>
                      <p><strong>Legal Requirements:</strong> When required by law, regulatory compliance, or to protect safety and security.</p>
                      <p>We never sell your personal information to third parties for marketing purposes.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Location Data Usage</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>During Active Hours:</strong> Continuous location tracking for order assignments, navigation, and delivery confirmation.</p>
                      <p><strong>Background Location:</strong> Limited tracking when app is backgrounded during active deliveries only.</p>
                      <p><strong>Location History:</strong> Stored for 90 days for dispute resolution, performance analysis, and service improvement.</p>
                      <p><strong>Opt-out Impact:</strong> Disabling location services will prevent you from receiving delivery opportunities.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Data Security</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Encryption:</strong> All data transmission uses industry-standard TLS encryption.</p>
                      <p><strong>Storage Security:</strong> Personal data stored in secure, encrypted databases with limited access controls.</p>
                      <p><strong>Payment Security:</strong> Financial information processed through PCI-DSS compliant payment partners.</p>
                      <p><strong>Account Protection:</strong> Multi-factor authentication, secure password requirements, and suspicious activity monitoring.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Your Rights & Controls</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Access & Update:</strong> View and modify your profile information, payment details, and communication preferences anytime.</p>
                      <p><strong>Data Download:</strong> Request a copy of your personal data in a portable format.</p>
                      <p><strong>Account Deletion:</strong> Permanently delete your account and associated data (subject to legal retention requirements).</p>
                      <p><strong>Marketing Opt-out:</strong> Unsubscribe from promotional communications while maintaining essential service notifications.</p>
                      <p><strong>Location Control:</strong> Manage location sharing preferences, though some features require location access.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Data Retention</h3>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Active Account:</strong> Data retained while your account is active and for service delivery.</p>
                      <p><strong>Financial Records:</strong> Earnings and payment data retained for 7 years for tax and legal compliance.</p>
                      <p><strong>Location History:</strong> GPS data automatically deleted after 90 days unless required for disputes.</p>
                      <p><strong>After Account Deletion:</strong> Personal data deleted within 30 days, except where legal retention is required.</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Children's Privacy</h3>
                    <p className="text-muted-foreground">Our services are not intended for users under 18 years of age. We do not knowingly collect personal information from children under 18.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Changes to Privacy Policy</h3>
                    <p className="text-muted-foreground">We may update this policy periodically. Significant changes will be communicated through the app with 30 days advance notice. Continued use constitutes acceptance of updated terms.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2">Contact Information</h3>
                    <div className="space-y-1 text-muted-foreground">
                      <p><strong>Address:</strong> Zaago Technologies Pvt Ltd Galiveedu, Annamayya district Andhra Pradesh 516267, India</p>
                    </div>
                  </div>

                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-foreground">
                      <strong>Last Updated:</strong> September 2024
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      This privacy policy is designed to be transparent about our data practices while ensuring we can provide you with the best delivery experience possible.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacySecurity;