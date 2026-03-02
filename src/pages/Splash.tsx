import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

const BOOT_DEADLINE_MS = 5000;

export default function Splash() {
  const navigate = useNavigate();
  const { session, profile, profileState, loading, initialize } = useAuthStore();
  const hasNavigated = useRef(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Single deterministic deadline — always exit splash
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      const state = useAuthStore.getState();
      if (state.session) {
        navigateByProfile(state.profile, state.profileState, navigate);
      } else {
        navigate('/login');
      }
    }, BOOT_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

  // Fast path — navigate as soon as auth resolves
  useEffect(() => {
    if (loading || hasNavigated.current) return;

    hasNavigated.current = true;

    if (!session) {
      navigate('/login');
      return;
    }

    // Session exists — wait briefly for profile if still loading
    if (profileState === 'idle' || profileState === 'loading') {
      // Will be handled by deadline or next state change
      hasNavigated.current = false;
      return;
    }

    navigateByProfile(profile, profileState, navigate);
  }, [session, profile, profileState, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="p-6 bg-primary rounded-3xl shadow-2xl"
        >
          <Truck className="h-16 w-16 text-primary-foreground" />
        </motion.div>
        <motion.h1
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.18, ease: "easeOut" }}
          className="text-3xl font-bold text-primary"
        >
          Zaago
        </motion.h1>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.18, ease: "easeOut" }}
          className="text-muted-foreground"
        >
          Delivery Partner
        </motion.p>
      </motion.div>
    </div>
  );
}

function navigateByProfile(
  profile: any,
  profileState: string,
  navigate: ReturnType<typeof useNavigate>,
) {
  // If profile errored or still loading, go to app and let guards handle it
  if (profileState === 'error' || profileState === 'loading' || profileState === 'idle') {
    navigate('/my-deliveries');
    return;
  }

  if (!profile || !profile.documents_submitted) {
    navigate('/upload-documents');
  } else if (profile.approval_status === 'deactivated' || profile.isActive === false) {
    navigate('/deactivated');
  } else if (profile.approval_status === 'pending') {
    navigate('/pending-approval');
  } else if (profile.approval_status === 'rejected') {
    navigate('/rejected');
  } else if (profile.approval_status === 'approved') {
    navigate('/home');
  } else {
    navigate('/my-deliveries');
  }
}
