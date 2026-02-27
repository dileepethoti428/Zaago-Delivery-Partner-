import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ComponentProps, memo } from 'react';
import { cn } from '@/lib/utils';
import { cardItem } from '@/animation/variants';

interface AnimatedCardProps extends ComponentProps<typeof Card> {
  delay?: number;
}

export const AnimatedCard = memo(function AnimatedCard({ delay = 0, className, children, ...props }: AnimatedCardProps) {
  const variants = cardItem(delay);
  
  return (
    <motion.div
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
    >
      <Card className={cn('cursor-pointer transition-all duration-100 hover:shadow-md active:scale-[0.98]', className)} {...props}>
        {children}
      </Card>
    </motion.div>
  );
});
