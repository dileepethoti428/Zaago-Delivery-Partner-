import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useLifecycleStore } from '@/store/lifecycle';

export function GlobalLoader() {
  const { isGlobalLoading, globalLoadingMessage } = useLifecycleStore();

  return (
    <AnimatePresence>
      {isGlobalLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {globalLoadingMessage && (
              <p className="text-sm text-muted-foreground">
                {globalLoadingMessage}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
