import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  Star
} from "lucide-react";

const Settings = () => {
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
          title: "Payment Methods",
          description: "Manage payout options",
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
          enabled: true
        },
        {
          icon: Volume2,
          title: "Sound Alerts",
          description: "Play sounds for new orders",
          action: "toggle",
          color: "text-primary",
          enabled: true
        },
        {
          icon: Vibrate,
          title: "Vibration",
          description: "Vibrate on new notifications",
          action: "toggle",
          color: "text-primary",
          enabled: false
        },
        {
          icon: MapPin,
          title: "Location Services",
          description: "Always track location",
          action: "toggle",
          color: "text-primary",
          enabled: true
        }
      ]
    },
    {
      title: "Delivery Settings",
      items: [
        {
          icon: Truck,
          title: "Vehicle Information",
          description: "Honda Civic 2020",
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
          icon: HelpCircle,
          title: "Help Center",
          description: "FAQs and support articles",
          action: "navigate",
          color: "text-primary"
        },
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
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Customize your app experience</p>
      </div>

      {/* Settings Groups */}
      <div className="space-y-6 animate-slide-up">
        {settingsGroups.map((group, groupIndex) => (
          <Card key={groupIndex} className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {group.items.map((item, itemIndex) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={itemIndex}
                    className="flex items-center justify-between p-3 hover:bg-secondary/50 rounded-lg transition-smooth cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <IconComponent className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    
                    {item.action === "toggle" ? (
                      <Switch 
                        defaultChecked={item.enabled}
                        className="data-[state=checked]:bg-primary"
                      />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
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
            <p className="text-sm text-muted-foreground">Version 2.1.0</p>
            <p className="text-xs text-muted-foreground">
              © 2024 Zaago Technologies. All rights reserved.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-card border-destructive/20 animate-slide-up">
        <CardContent className="p-4">
          <Button 
            variant="outline" 
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;