import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { useAppStore } from '@/store/app';

export default function Splash() {
  const navigate = useNavigate();
  const isAuthed = useAppStore((state) => state.isAuthed);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(isAuthed ? '/home' : '/login');
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthed, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="p-6 bg-primary rounded-3xl shadow-2xl"
        >
          <Truck className="h-16 w-16 text-primary-foreground" />
        </motion.div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-bold text-primary"
        >
          Zaago
        </motion.h1>
        
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground"
        >
          Delivery Agent
        </motion.p>
      </motion.div>
    </div>
  );
}
