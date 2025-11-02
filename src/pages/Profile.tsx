import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  User, 
  Star, 
  Truck, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  Edit,
  Shield,
  Award,
  ArrowLeft,
  Save,
  Camera
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ProfileData {
  id?: string;
  user_id?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  address?: string;
  emergency_contact?: string;
  created_at?: string;
  updated_at?: string;
}

interface AgentStats {
  total_deliveries: number;
  average_rating: number;
  total_earnings: number;
  performance_score: number;
  is_active: boolean;
  last_delivery_at?: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [agentStats, setAgentStats] = useState<AgentStats>({
    total_deliveries: 0,
    average_rating: 0,
    total_earnings: 0,
    performance_score: 100,
    is_active: false
  });
  const [editData, setEditData] = useState<ProfileData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('No authenticated user found');
      }
      
      // Get agent data with stats
      const { data: agent, error: agentError } = await supabase
        .from('delivery_agents')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (agentError) throw agentError;

      if (!agent) {
        // No agent record exists, show message and redirect to setup
        toast({
          title: "Profile Setup Required",
          description: "Please complete your delivery agent setup first.",
          variant: "destructive"
        });
        navigate('/bank-details-setup');
        return;
      }

      // Set agent stats
      setAgentStats({
        total_deliveries: agent.total_deliveries || 0,
        average_rating: agent.average_rating || 0,
        total_earnings: agent.total_earnings || 0,
        performance_score: agent.performance_score || 100,
        is_active: agent.is_active || false,
        last_delivery_at: agent.last_delivery_at
      });

      // Try to get profile data (if exists)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', agent.agent_id)
        .maybeSingle();

      // Get agent documents for profile photo (using user_id since agent_id might be null)
      const { data: agentDocs } = await supabase
        .from('agent_documents')
        .select('profile_photo_url')
        .eq('user_id', agent.agent_id)
        .maybeSingle();

      // Generate public URL for the profile photo from storage
      let photoUrl = agentDocs?.profile_photo_url || profile?.photo_url;
      if (photoUrl && !photoUrl.startsWith('http')) {
        const { data } = supabase.storage
          .from('agent-documents')
          .getPublicUrl(photoUrl);
        photoUrl = data.publicUrl;
      }

      const profileInfo = {
        full_name: profile?.full_name || agent.name,
        phone: profile?.phone || agent.phone,
        email: agent.email,
        photo_url: photoUrl,
        address: profile?.address || '',
        emergency_contact: profile?.emergency_contact || '',
        user_id: agent.agent_id
      };

      setProfileData(profileInfo);
      setEditData(profileInfo);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: `Failed to load profile data: ${error.message || 'Please try again.'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);

      // Update or create profile
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          user_id: editData.user_id,
          full_name: editData.full_name,
          phone: editData.phone,
          address: editData.address,
          emergency_contact: editData.emergency_contact,
          photo_url: editData.photo_url,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Update delivery agent name if changed
      if (editData.full_name !== profileData.full_name) {
        const { error: agentError } = await supabase
          .from('delivery_agents')
          .update({ name: editData.full_name })
          .eq('email', profileData.email);

        if (agentError) throw agentError;
      }

      setProfileData(editData);
      setIsEditDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const achievements = [
    { title: "Speed Demon", description: "100+ fast deliveries", icon: "⚡", unlocked: agentStats.total_deliveries >= 100 },
    { title: "Customer Favorite", description: "4.5+ star rating", icon: "⭐", unlocked: agentStats.average_rating >= 4.5 },
    { title: "Veteran Driver", description: "500+ deliveries", icon: "🏆", unlocked: agentStats.total_deliveries >= 500 },
    { title: "Top Performer", description: "95+ performance score", icon: "✅", unlocked: agentStats.performance_score >= 95 }
  ];

  const stats = [
    { label: "Total Deliveries", value: agentStats.total_deliveries.toString(), icon: Truck },
    { label: "Average Rating", value: `${agentStats.average_rating.toFixed(1)}/5`, icon: Star },
    { label: "Total Earnings", value: `₹${agentStats.total_earnings.toFixed(2)}`, icon: Phone },
    { label: "Performance", value: `${agentStats.performance_score}%`, icon: Award }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading profile...</p>
        </div>
      </div>
    );
  }

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground">Manage your delivery agent profile</p>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Edit className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={editData.full_name || ''}
                  onChange={(e) => setEditData({...editData, full_name: e.target.value})}
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={editData.phone || ''}
                  onChange={(e) => setEditData({...editData, phone: e.target.value})}
                  placeholder="Enter your phone number"
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={editData.address || ''}
                  onChange={(e) => setEditData({...editData, address: e.target.value})}
                  placeholder="Enter your address"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="emergency">Emergency Contact</Label>
                <Input
                  id="emergency"
                  value={editData.emergency_contact || ''}
                  onChange={(e) => setEditData({...editData, emergency_contact: e.target.value})}
                  placeholder="Emergency contact number"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Profile Header */}
      <Card className="bg-gradient-dark border-primary/20 animate-fade-in">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-primary">
                <AvatarImage 
                  src={profileData.photo_url} 
                  alt={profileData.full_name || 'Agent'} 
                  className="object-cover"
                />
                <AvatarFallback className="bg-gradient-neon">
                  <User className="w-10 h-10 text-white" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                {agentStats.is_active ? '🟢' : '🔴'}
              </div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">
                {profileData.full_name || 'Agent Name'}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={`${agentStats.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                  {agentStats.is_active ? 'Active Agent' : 'Inactive'}
                </Badge>
                <Badge variant="outline" className="border-primary/30">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Star className="w-4 h-4 text-primary" />
                  <span>{agentStats.average_rating.toFixed(1)} Rating</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Truck className="w-4 h-4 text-primary" />
                  <span>{agentStats.total_deliveries} Deliveries</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium text-foreground">{profileData.email}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Phone className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{profileData.phone || 'Not provided'}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <MapPin className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium text-foreground">{profileData.address || 'Not provided'}</p>
            </div>
          </div>

          {profileData.emergency_contact && (
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Emergency Contact</p>
                <p className="font-medium text-foreground">{profileData.emergency_contact}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Performance Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-3 bg-secondary/50 rounded-lg">
                <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg border-2 transition-all ${
                  achievement.unlocked 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-muted/50 border-muted-foreground/20 opacity-60'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">{achievement.icon}</div>
                  <p className="font-medium text-sm text-foreground">{achievement.title}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  {achievement.unlocked && (
                    <Badge className="mt-2 bg-primary/20 text-primary text-xs">
                      Unlocked
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Add bottom padding for navigation */}
      <div className="h-20"></div>
    </div>
  );
};

export default Profile;