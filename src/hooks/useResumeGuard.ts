import { useEffect, useRef } from 'react';

/**
 * Hook that calls a callback when the app resumes from background
 * Use this in components that have local loading states
 * 
 * @param onResume - Function to call on app resume (reset loading, etc.)
 * @param deps - Dependencies array for the callback
 */
export function useResumeGuard(
  onResume: () => void,
  deps: React.DependencyList = []
) {
  const lastVisibleRef = useRef(document.visibilityState === 'visible');
  const callbackRef = useRef(onResume);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onResume;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResume, ...deps]);

  useEffect(() => {
    const handleVisibility = () => {
      const isNowVisible = document.visibilityState === 'visible';
      
      // Only trigger on transition from hidden -> visible
      if (isNowVisible && !lastVisibleRef.current) {
        callbackRef.current();
      }
      
      lastVisibleRef.current = isNowVisible;
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);
}
