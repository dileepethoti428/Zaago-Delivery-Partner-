import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cache } from '@/utils/cache';

export default function Splash() {
  const navigate = useNavigate();
  const { session, profile, loading, initialize } = useAuthStore();
  const hasCache = cache.hasCache();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (loading) return;

    const delay = hasCache ? 200 : 1500;
    const timer = setTimeout(() => {
      if (!session) {
        navigate('/login');
        return;
      }

      // User is authenticated, check profile status
      if (!profile || !profile.documents_submitted) {
        navigate('/upload-documents');
      } else if (profile.approval_status === 'pending') {
        navigate('/pending-approval');
      } else if (profile.approval_status === 'rejected') {
        navigate('/rejected');
      } else if (profile.approval_status === 'approved') {
        navigate('/home');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [session, profile, loading, navigate, hasCache]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
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
          Delivery Agent
        </motion.p>
      </motion.div>
    </div>
  );
}
