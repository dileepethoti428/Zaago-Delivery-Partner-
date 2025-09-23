import { useRef, useCallback, useEffect } from 'react';

export const useAudioNotification = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on first use
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/phone-ringtone.mp3');
      audioRef.current.volume = 0.7;
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
      // Play ringtone 3 times with delays
      playRingtone();
      
      setTimeout(() => playRingtone(), 2000);
      setTimeout(() => playRingtone(), 4000);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [playRingtone]);

  return { playNotificationSound };
};