export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const pageTransitionConfig = {
  duration: 0.14,
  ease: [0.4, 0, 0.2, 1] as const,
};

export const cardItem = (delay = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { 
    opacity: 1, 
    y: 0,
  },
  transition: {
    delay,
    duration: 0.12,
    ease: [0.4, 0, 0.2, 1] as const,
  },
});

export const tapScale = {
  whileTap: { scale: 0.96 },
};
