import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends ComponentProps<typeof Card> {
  delay?: number;
}

export function AnimatedCard({ delay = 0, className, children, ...props }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className={cn('cursor-pointer transition-shadow hover:shadow-lg', className)} {...props}>
        {children}
      </Card>
    </motion.div>
  );
}
