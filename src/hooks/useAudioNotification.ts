import { useRef, useCallback, useEffect } from 'react';

export const useAudioNotification = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Initialize audio on first use
  useEffect(() => {
    if (!audioRef.current) {
      // Try notification-sound.mp3 first, fallback to phone-ringtone.mp3
      audioRef.current = new Audio('/notification-sound.mp3');
      audioRef.current.volume = 1.0; // Maximum volume
      audioRef.current.playbackRate = 1.2; // Faster playback for urgency
      audioRef.current.preload = 'auto';
      
      // Fallback to phone ringtone if notification sound fails
      audioRef.current.addEventListener('error', () => {
        if (audioRef.current) {
          audioRef.current.src = '/phone-ringtone.mp3';
        }
      });
      
      // Setup Web Audio API for volume amplification
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContextRef.current && audioRef.current) {
          const source = audioContextRef.current.createMediaElementSource(audioRef.current);
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.value = 2.0; // Amplify beyond 100%
          source.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
        }
      } catch (error) {
        console.warn('Web Audio API not supported, using standard audio');
      }
      
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
      // Ensure audio context is resumed (required by some browsers)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // Immediate urgent burst pattern: 10 rapid-fire rings in 3 seconds
      playRingtone(); // Immediate
      setTimeout(() => playRingtone(), 100); // Quick double burst
      setTimeout(() => playRingtone(), 400);
      setTimeout(() => playRingtone(), 800);
      setTimeout(() => playRingtone(), 1200);
      setTimeout(() => playRingtone(), 1600);
      setTimeout(() => playRingtone(), 2000);
      setTimeout(() => playRingtone(), 2300);
      setTimeout(() => playRingtone(), 2600);
      setTimeout(() => playRingtone(), 3000);
      
      // Intense vibration pattern for mobile devices
      if (window.navigator && window.navigator.vibrate) {
        // Immediate strong vibration
        window.navigator.vibrate([400, 100, 400, 100, 400]);
        // Follow-up vibrations
        setTimeout(() => {
          if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([200, 100, 200, 100, 200]);
          }
        }, 1500);
        setTimeout(() => {
          if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([300, 100, 300]);
          }
        }, 2500);
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [playRingtone]);

  return { playNotificationSound };
};