import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth';

interface AgentSettings {
  profile: any;
  settings: any;
  bankDetails: any;
  documents: any;
}

export function useAgentSettings() {
  const { session } = useAuthStore();
  
  return useQuery({
    queryKey: ['agent-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-agent-settings', {
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
        },
      });
      
      if (error) throw error;
      return data as AgentSettings;
    },
    enabled: !!session?.access_token,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (profileData: any) => {
      const { data, error } = await supabase.functions.invoke('update-agent-profile', {
        body: profileData,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (preferencesData: any) => {
      const { data, error } = await supabase.functions.invoke('update-agent-preferences', {
        body: preferencesData,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      toast.success('Preferences updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update preferences');
    },
  });
}

export function useUpdateNotifications() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationsData: any) => {
      const { data, error } = await supabase.functions.invoke('update-agent-notifications', {
        body: notificationsData,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      toast.success('Notification settings updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update notifications');
    },
  });
}

export function useUpdatePayout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payoutData: any) => {
      const { data, error } = await supabase.functions.invoke('update-agent-payout', {
        body: payoutData,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      toast.success('Bank details updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update bank details');
    },
  });
}

export function useUpdateKYC() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (kycData: any) => {
      const { data, error } = await supabase.functions.invoke('update-agent-kyc', {
        body: kycData,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      toast.success('KYC details submitted for review');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update KYC details');
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('delete-agent-account', {
        method: 'POST',
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success('Account deactivated successfully');
      await supabase.auth.signOut();
      queryClient.clear();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete account');
    },
  });
}
