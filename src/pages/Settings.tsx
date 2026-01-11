import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, User, Settings as SettingsIcon, Bell, CreditCard, FileText, Globe, LogOut, Trash2, HelpCircle, Shield, ChevronRight, Send, ArrowLeft } from 'lucide-react';
import { useAgentSettings, useUpdateProfile, useUpdatePreferences, useUpdateNotifications, useUpdatePayout, useUpdateKYC, useDeleteAccount } from '@/hooks/useSettings';
import { profileSchema, payoutSchema, kycSchema, notificationsSchema, preferencesSchema, type ProfileFormData, type PayoutFormData, type KYCFormData, type NotificationsFormData, type PreferencesFormData } from '@/utils/settingsValidation';
import { useAuthStore } from '@/store/auth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut, user } = useAuthStore();
  const { data: settings, isLoading } = useAgentSettings();
  const [testingNotification, setTestingNotification] = useState(false);

  const handleTestNotification = async () => {
    if (!user?.email) {
      toast.error('No user email found');
      return;
    }
    
    setTestingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userEmail: user.email,
          title: "Test Notification",
          message: "Push notifications are working!"
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Test notification sent! Recipients: ${data.recipients}`);
      } else {
        toast.error('Notification sent but no recipients received it');
      }
    } catch (err: any) {
      console.error('Test notification error:', err);
      toast.error(err.message || 'Failed to send test notification');
    } finally {
      setTestingNotification(false);
    }
  };
  
  const updateProfile = useUpdateProfile();
  const updatePreferences = useUpdatePreferences();
  const updateNotifications = useUpdateNotifications();
  const updatePayout = useUpdatePayout();
  const updateKYC = useUpdateKYC();
  const deleteAccount = useDeleteAccount();

  // Profile form
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: settings?.profile?.name || '',
      phone: settings?.profile?.phone || '',
      vehicle_type: settings?.profile?.vehicle_type || undefined,
      vehicle_number: settings?.profile?.vehicle_number || '',
      profile_image_url: settings?.profile?.profile_image || '',
    },
  });

  // Preferences form
  const preferencesForm = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    values: {
      is_available: settings?.settings?.is_available ?? true,
      auto_accept_orders: settings?.settings?.auto_accept_orders ?? false,
      preferred_language: settings?.settings?.preferred_language || 'en',
      dark_mode: settings?.settings?.dark_mode ?? false,
    },
  });

  // Notifications form
  const notificationsForm = useForm<NotificationsFormData>({
    resolver: zodResolver(notificationsSchema),
    values: {
      notify_new_orders: settings?.settings?.notify_new_orders ?? true,
      notify_earnings_updates: settings?.settings?.notify_earnings_updates ?? true,
      notify_promotions: settings?.settings?.notify_promotions ?? true,
    },
  });

  // Payout form
  const payoutForm = useForm<PayoutFormData>({
    resolver: zodResolver(payoutSchema),
    values: {
      bank_account_name: settings?.bankDetails?.account_holder_name || '',
      bank_account_number: settings?.bankDetails?.account_number || '',
      ifsc_code: settings?.bankDetails?.ifsc_code || '',
      bank_name: settings?.bankDetails?.bank_name || '',
      upi_id: settings?.bankDetails?.upi_id || '',
    },
  });

  // KYC form
  const kycForm = useForm<KYCFormData>({
    resolver: zodResolver(kycSchema),
    values: {
      aadhar_number_masked: settings?.documents?.aadhar_number || '',
      driving_license_number_masked: settings?.documents?.dl_number || '',
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };

  const onPreferencesChange = (field: keyof PreferencesFormData, value: any) => {
    // Apply dark mode immediately
    if (field === 'dark_mode') {
      if (value) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    
    const currentValues = preferencesForm.getValues();
    updatePreferences.mutate({ ...currentValues, [field]: value });
    preferencesForm.setValue(field, value);
  };

  const onNotificationsSubmit = (data: NotificationsFormData) => {
    updateNotifications.mutate(data);
  };

  const onPayoutSubmit = (data: PayoutFormData) => {
    updatePayout.mutate(data);
  };

  const onKYCSubmit = (data: KYCFormData) => {
    updateKYC.mutate(data);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate();
  };

  const getKYCBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'in_review': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <SettingsIcon className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your profile and preferences</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profileForm.watch('profile_image_url')} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {profileForm.watch('full_name')?.charAt(0)?.toUpperCase() || 'A'}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  {...profileForm.register('full_name')}
                  placeholder="Enter your full name"
                />
                {profileForm.formState.errors.full_name && (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  {...profileForm.register('phone')}
                  placeholder="10-digit phone number"
                />
                {profileForm.formState.errors.phone && (
                  <p className="text-sm text-destructive">{profileForm.formState.errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Select
                  value={profileForm.watch('vehicle_type')}
                  onValueChange={(value) => profileForm.setValue('vehicle_type', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="Scooter">Scooter</SelectItem>
                    <SelectItem value="Cycle">Cycle</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_number">Vehicle Number</Label>
                <Input
                  id="vehicle_number"
                  {...profileForm.register('vehicle_number')}
                  placeholder="Enter vehicle number"
                />
              </div>

              <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Profile
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Availability Section */}
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
            <CardDescription>Control your order acceptance settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Online for deliveries</Label>
                <p className="text-sm text-muted-foreground">Receive orders in your area</p>
              </div>
              <Switch
                checked={preferencesForm.watch('is_available')}
                onCheckedChange={(checked) => onPreferencesChange('is_available', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-accept nearby orders</Label>
                <p className="text-sm text-muted-foreground">Automatically accept orders</p>
              </div>
              <Switch
                checked={preferencesForm.watch('auto_accept_orders')}
                onCheckedChange={(checked) => onPreferencesChange('auto_accept_orders', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={notificationsForm.handleSubmit(onNotificationsSubmit)} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>New order alerts</Label>
                <Switch
                  checked={notificationsForm.watch('notify_new_orders')}
                  onCheckedChange={(checked) => notificationsForm.setValue('notify_new_orders', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Earnings updates</Label>
                <Switch
                  checked={notificationsForm.watch('notify_earnings_updates')}
                  onCheckedChange={(checked) => notificationsForm.setValue('notify_earnings_updates', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label>Promotions & offers</Label>
                <Switch
                  checked={notificationsForm.watch('notify_promotions')}
                  onCheckedChange={(checked) => notificationsForm.setValue('notify_promotions', checked)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={updateNotifications.isPending}>
                {updateNotifications.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Notification Settings
              </Button>
            </form>

            <div className="border-t pt-4 mt-4">
              <Button 
                type="button"
                variant="outline" 
                className="w-full"
                onClick={handleTestNotification}
                disabled={testingNotification}
              >
                {testingNotification ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Test Notification
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Test if push notifications are working on your device
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payout & Bank Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Payout & Bank Details</CardTitle>
            </div>
            <CardDescription>We use this account to send your payouts</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={payoutForm.handleSubmit(onPayoutSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank_account_name">Account Holder Name</Label>
                <Input
                  id="bank_account_name"
                  {...payoutForm.register('bank_account_name')}
                  placeholder="As per bank records"
                />
                {payoutForm.formState.errors.bank_account_name && (
                  <p className="text-sm text-destructive">{payoutForm.formState.errors.bank_account_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_account_number">Account Number</Label>
                <Input
                  id="bank_account_number"
                  {...payoutForm.register('bank_account_number')}
                  placeholder="Enter account number"
                />
                {payoutForm.formState.errors.bank_account_number && (
                  <p className="text-sm text-destructive">{payoutForm.formState.errors.bank_account_number.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ifsc_code">IFSC Code</Label>
                <Input
                  id="ifsc_code"
                  {...payoutForm.register('ifsc_code')}
                  placeholder="ABCD0123456"
                  maxLength={11}
                />
                {payoutForm.formState.errors.ifsc_code && (
                  <p className="text-sm text-destructive">{payoutForm.formState.errors.ifsc_code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  {...payoutForm.register('bank_name')}
                  placeholder="Enter bank name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="upi_id">UPI ID (Optional)</Label>
                <Input
                  id="upi_id"
                  {...payoutForm.register('upi_id')}
                  placeholder="example@upi"
                />
                {payoutForm.formState.errors.upi_id && (
                  <p className="text-sm text-destructive">{payoutForm.formState.errors.upi_id.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={updatePayout.isPending}>
                {updatePayout.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Payout Details
              </Button>
            </form>
          </CardContent>
        </Card>


        {/* App Preferences Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>App Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={preferencesForm.watch('preferred_language')}
                onValueChange={(value) => onPreferencesChange('preferred_language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="ta">Tamil</SelectItem>
                  <SelectItem value="te">Telugu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Dark Mode</Label>
              <Switch
                checked={preferencesForm.watch('dark_mode')}
                onCheckedChange={(checked) => onPreferencesChange('dark_mode', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Legal Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Legal</CardTitle>
            </div>
            <CardDescription>Privacy Policy & Terms of Service</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => navigate('/privacy-policy')}
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Privacy Policy
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-between" 
              onClick={() => navigate('/terms-conditions')}
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Terms & Conditions
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will sign you out and deactivate your delivery partner account. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
