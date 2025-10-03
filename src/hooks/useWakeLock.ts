import { useEffect, useRef, useState } from 'react';

export const useWakeLock = (isEnabled: boolean = false) => {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isActive, setIsActive] = useState(false);

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('⚠️ Wake Lock API not supported');
      return false;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      console.log('🔒 Wake lock activated - app will stay active in background');

      wakeLockRef.current.addEventListener('release', () => {
        console.log('🔓 Wake lock released');
        setIsActive(false);
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to acquire wake lock:', error);
      return false;
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
        console.log('🔓 Wake lock released manually');
      } catch (error) {
        console.error('❌ Error releasing wake lock:', error);
      }
    }
  };

  useEffect(() => {
    if (isEnabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Re-acquire wake lock when page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isEnabled && !wakeLockRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isEnabled]);

  return { isActive, requestWakeLock, releaseWakeLock };
};
