import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { LogOut, User, DollarSign, HelpCircle, ChevronRight, CheckCircle, Clock, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const menuItems = [
    { icon: User, label: 'Edit Profile', action: () => console.log('Edit profile') },
    { icon: DollarSign, label: 'Payout Settings', action: () => console.log('Payout settings') },
    { icon: HelpCircle, label: 'Help & Support', action: () => console.log('Help') },
  ];

  return (
    <AppShell>
      <div className="space-y-6 py-4">
        <h1 className="text-2xl font-bold">Profile</h1>

        <Card className="rounded-2xl border-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {profile?.full_name ? profile.full_name.split(' ').map(n => n[0]).join('') : 'DA'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="text-xl font-bold">{profile?.full_name || 'Delivery Agent'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-2">
                  {profile?.approval_status === 'approved' && (
                    <Badge className="gap-1" variant="default">
                      <CheckCircle className="h-3 w-3" />
                      Approved
                    </Badge>
                  )}
                  {profile?.approval_status === 'pending' && (
                    <Badge className="gap-1" variant="secondary">
                      <Clock className="h-3 w-3" />
                      Pending Review
                    </Badge>
                  )}
                  {profile?.approval_status === 'rejected' && (
                    <Badge className="gap-1" variant="destructive">
                      <XCircle className="h-3 w-3" />
                      Rejected
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

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </motion.button>
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
  );
}
