import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Star, 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  Edit,
  Settings,
  Shield,
  Award
} from "lucide-react";

const Profile = () => {
  const navigate = useNavigate();
  const profileData = {
    name: "Alex Rodriguez",
    phone: "+1 (555) 123-4567",
    email: "alex.rodriguez@email.com",
    rating: 4.8,
    totalDeliveries: 1247,
    joinDate: "March 2023",
    status: "Premium Agent",
    vehicle: "Honda Civic 2020",
    license: "DL-789456123"
  };

  const achievements = [
    { title: "Speed Demon", description: "100+ fast deliveries", icon: "⚡" },
    { title: "Customer Favorite", description: "500+ 5-star ratings", icon: "⭐" },
    { title: "Distance King", description: "1000+ km delivered", icon: "🏆" },
    { title: "Reliability Pro", description: "99% on-time rate", icon: "✅" }
  ];

  const stats = [
    { label: "Total Deliveries", value: profileData.totalDeliveries, icon: Truck },
    { label: "Average Rating", value: `${profileData.rating}/5`, icon: Star },
    { label: "On-Time Rate", value: "99%", icon: Clock },
    { label: "Active Since", value: profileData.joinDate, icon: MapPin }
  ];

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Profile Header */}
      <Card className="bg-gradient-dark border-primary/20 animate-fade-in">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground">{profileData.name}</h2>
              <p className="text-muted-foreground">{profileData.phone}</p>
              <div className="flex items-center space-x-2 mt-2">
                <Badge className="bg-primary text-primary-foreground">
                  {profileData.status}
                </Badge>
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-primary fill-current" />
                  <span className="text-sm font-medium text-foreground">{profileData.rating}</span>
                </div>
              </div>
            </div>
            <Button size="icon" variant="outline" className="border-border">
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 animate-slide-up">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <IconComponent className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Achievements */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-primary" />
            <span>Achievements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement, index) => (
              <div key={index} className="p-3 bg-secondary/50 rounded-lg">
                <div className="text-2xl mb-2">{achievement.icon}</div>
                <h4 className="font-semibold text-foreground text-sm">{achievement.title}</h4>
                <p className="text-xs text-muted-foreground">{achievement.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium text-foreground">{profileData.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{profileData.phone}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Truck className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Vehicle</p>
              <p className="font-medium text-foreground">{profileData.vehicle}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">License</p>
              <p className="font-medium text-foreground">{profileData.license}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3 animate-slide-up">
        <Button className="w-full bg-gradient-neon hover:shadow-neon transition-smooth">
          <Edit className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
        
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="border-border"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button 
            variant="outline" 
            className="border-border"
            onClick={() => navigate('/help')}
          >
            <Shield className="w-4 h-4 mr-2" />
            Help
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;