import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, FileText, Camera, Loader2, LogOut } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { documentUploadSchema, type DocumentUploadFormData } from '@/utils/validation';

export default function UploadDocuments() {
  const navigate = useNavigate();
  const { user, fetchProfile, signOut } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const form = useForm<DocumentUploadFormData>({
    resolver: zodResolver(documentUploadSchema),
  });

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  };

  const handleSubmit = async (data: DocumentUploadFormData) => {
    if (!user) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      // Upload files
      setUploadProgress(20);
      const profilePhotoUrl = await uploadFile(
        data.profilePhoto,
        'agent-photos',
        `${user.id}/profile.jpg`
      );

      setUploadProgress(35);
      const aadharFrontUrl = await uploadFile(
        data.aadharFront,
        'agent-documents',
        `${user.id}/aadhar-front.jpg`
      );

      setUploadProgress(50);
      const aadharBackUrl = await uploadFile(
        data.aadharBack,
        'agent-documents',
        `${user.id}/aadhar-back.jpg`
      );

      setUploadProgress(65);
      const licenseFrontUrl = await uploadFile(
        data.licenseFront,
        'agent-documents',
        `${user.id}/license-front.jpg`
      );

      setUploadProgress(80);
      const licenseBackUrl = await uploadFile(
        data.licenseBack,
        'agent-documents',
        `${user.id}/license-back.jpg`
      );

      // Update profile
      setUploadProgress(85);
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: data.fullName,
        phone: data.phone,
        date_of_birth: data.dob,
        emergency_contact: data.emergencyContact,
        documents_submitted: true,
        submission_date: new Date().toISOString(),
      }).eq('user_id', user.id);

      if (profileError) throw profileError;

      // Insert agent documents
      setUploadProgress(90);
      const { error: docsError } = await supabase.from('agent_documents').upsert({
        user_id: user.id,
        aadhar_number: data.aadharNumber,
        aadhar_front_url: aadharFrontUrl,
        aadhar_back_url: aadharBackUrl,
        dl_number: data.licenseNumber,
        dl_expiry_date: data.licenseExpiry,
        dl_front_url: licenseFrontUrl,
        dl_back_url: licenseBackUrl,
        profile_photo_url: profilePhotoUrl,
        uploaded_at: new Date().toISOString(),
      });

      if (docsError) throw docsError;

      // Upsert delivery agent record (create or update)
      setUploadProgress(95);
      const { error: agentError } = await supabase.from('delivery_agents').upsert({
        agent_id: user.id,
        email: user.email,
        name: data.fullName,
        phone: data.phone,
        verification_status: 'pending',
        documents_verified: false,
        is_active: false,
        profile_image: profilePhotoUrl,
      }, { 
        onConflict: 'agent_id',
        ignoreDuplicates: false 
      });

      if (agentError) {
        console.error('Agent upsert error:', agentError);
        // Don't throw - agent might exist already and that's OK
      }

      setUploadProgress(100);
      toast({
        title: 'Documents submitted',
        description: 'Your documents are under review',
      });

      await fetchProfile();
      navigate('/pending-approval');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload documents',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <Card className="rounded-2xl shadow-xl border-0 bg-card/50 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Upload Documents</CardTitle>
                <CardDescription>
                  Submit your documents to become a Zaago delivery partner
                </CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Exit Document Upload?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to logout? Any unsaved progress will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Personal Information
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      className="rounded-xl"
                      {...form.register('fullName')}
                    />
                    {form.formState.errors.fullName && (
                      <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="9876543210"
                      className="rounded-xl"
                      {...form.register('phone')}
                    />
                    {form.formState.errors.phone && (
                      <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      className="rounded-xl"
                      {...form.register('dob')}
                    />
                    {form.formState.errors.dob && (
                      <p className="text-sm text-destructive">{form.formState.errors.dob.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      placeholder="9876543210"
                      className="rounded-xl"
                      {...form.register('emergencyContact')}
                    />
                    {form.formState.errors.emergencyContact && (
                      <p className="text-sm text-destructive">{form.formState.errors.emergencyContact.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Aadhar Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Aadhar Details</h3>

                <div className="space-y-2">
                  <Label htmlFor="aadharNumber">Aadhar Number</Label>
                  <Input
                    id="aadharNumber"
                    placeholder="123456789012"
                    maxLength={12}
                    className="rounded-xl"
                    {...form.register('aadharNumber')}
                  />
                  {form.formState.errors.aadharNumber && (
                    <p className="text-sm text-destructive">{form.formState.errors.aadharNumber.message}</p>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aadharFront">Aadhar Front (Max 5MB)</Label>
                    <Input
                      id="aadharFront"
                      type="file"
                      accept="image/*"
                      className="rounded-xl"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) form.setValue('aadharFront', file);
                      }}
                    />
                    {form.formState.errors.aadharFront && (
                      <p className="text-sm text-destructive">{form.formState.errors.aadharFront.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aadharBack">Aadhar Back (Max 5MB)</Label>
                    <Input
                      id="aadharBack"
                      type="file"
                      accept="image/*"
                      className="rounded-xl"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) form.setValue('aadharBack', file);
                      }}
                    />
                    {form.formState.errors.aadharBack && (
                      <p className="text-sm text-destructive">{form.formState.errors.aadharBack.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* License Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Driving License</h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input
                      id="licenseNumber"
                      placeholder="DL1234567890"
                      className="rounded-xl"
                      {...form.register('licenseNumber')}
                    />
                    {form.formState.errors.licenseNumber && (
                      <p className="text-sm text-destructive">{form.formState.errors.licenseNumber.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseExpiry">Expiry Date</Label>
                    <Input
                      id="licenseExpiry"
                      type="date"
                      className="rounded-xl"
                      {...form.register('licenseExpiry')}
                    />
                    {form.formState.errors.licenseExpiry && (
                      <p className="text-sm text-destructive">{form.formState.errors.licenseExpiry.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseFront">License Front (Max 5MB)</Label>
                    <Input
                      id="licenseFront"
                      type="file"
                      accept="image/*"
                      className="rounded-xl"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) form.setValue('licenseFront', file);
                      }}
                    />
                    {form.formState.errors.licenseFront && (
                      <p className="text-sm text-destructive">{form.formState.errors.licenseFront.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licenseBack">License Back (Max 5MB)</Label>
                    <Input
                      id="licenseBack"
                      type="file"
                      accept="image/*"
                      className="rounded-xl"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) form.setValue('licenseBack', file);
                      }}
                    />
                    {form.formState.errors.licenseBack && (
                      <p className="text-sm text-destructive">{form.formState.errors.licenseBack.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Photo */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Profile Photo
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="profilePhoto">Upload Photo (Max 5MB)</Label>
                  <Input
                    id="profilePhoto"
                    type="file"
                    accept="image/*"
                    className="rounded-xl"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) form.setValue('profilePhoto', file);
                    }}
                  />
                  {form.formState.errors.profilePhoto && (
                    <p className="text-sm text-destructive">{form.formState.errors.profilePhoto.message}</p>
                  )}
                </div>
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full rounded-xl h-12 text-base font-medium"
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 mr-2" />
                    Submit Documents
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
