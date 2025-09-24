import { useRef, useCallback, useEffect } from 'react';

export const useAudioNotification = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on first use
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/phone-ringtone.mp3');
      audioRef.current.volume = 1.0; // Maximum volume for iPhone-like sound
      audioRef.current.preload = 'auto';
      
      // Handle audio loading errors
      audioRef.current.addEventListener('error', (e) => {
        console.error('Error loading ringtone audio:', e);
      });
    }

    // Cleanup function
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const playRingtone = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      // Reset audio to beginning
      audioRef.current.currentTime = 0;
      
      // Play the ringtone
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
      // Fallback to system beep if audio fails
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200]);
      }
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      // iPhone-like persistent ringing pattern: 6 rings with 1-second intervals
      playRingtone();
      
      setTimeout(() => playRingtone(), 1000);
      setTimeout(() => playRingtone(), 2000);
      setTimeout(() => playRingtone(), 3000);
      setTimeout(() => playRingtone(), 4000);
      setTimeout(() => playRingtone(), 5000);
      
      // Enhanced vibration pattern for mobile devices (iPhone-like)
      if (window.navigator && window.navigator.vibrate) {
        // Vibrate immediately
        window.navigator.vibrate([300, 150, 300, 150, 300]);
        // Additional vibration after 2 seconds
        setTimeout(() => {
          if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([300, 150, 300]);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [playRingtone]);

  return { playNotificationSound };
};