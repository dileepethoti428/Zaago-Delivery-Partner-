import { useRef, useCallback } from 'react';

export const useAudioNotification = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const createRingtone = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    // Create classic phone ringtone pattern
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(900, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
    
    return oscillator;
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      // Play ringtone pattern 3 times
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          createRingtone();
        }, i * 1500);
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
    }
  }, [createRingtone]);

  return { playNotificationSound };
};