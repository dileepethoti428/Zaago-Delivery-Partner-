import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { cardItem, tapScale } from '@/animation/variants';

interface AnimatedCardProps extends ComponentProps<typeof Card> {
  delay?: number;
}

export function AnimatedCard({ delay = 0, className, children, ...props }: AnimatedCardProps) {
  const variants = cardItem(delay);
  
  return (
    <motion.div
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
      whileTap={tapScale.whileTap}
    >
      <Card className={cn('cursor-pointer transition-shadow hover:shadow-md', className)} {...props}>
        {children}
      </Card>
    </motion.div>
  );
}
