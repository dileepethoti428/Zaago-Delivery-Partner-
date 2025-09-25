import { useRef, useCallback, useEffect } from 'react';

export interface RingtoneSettings {
  enabled: boolean;
  volume: number;
  type: string;
  frequency: string;
}

export const useAudioNotification = (settings?: RingtoneSettings) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentRingtoneType = useRef<string>('');

  // Always define all callbacks first to maintain hook order
  const playRingtone = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      // Reset audio to beginning
      audioRef.current.currentTime = 0;
      
      // Resume audio context if suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
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
    // Don't play if disabled
    if (settings?.enabled === false) return;
    
    try {
      // Ensure audio context is resumed (required by some browsers)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // Play based on frequency setting
      const frequency = settings?.frequency || 'double';
      
      if (frequency === 'single') {
        playRingtone();
      } else if (frequency === 'double') {
        playRingtone();
        setTimeout(() => playRingtone(), 100);
      } else if (frequency === 'continuous') {
        // Continuous pattern: 10 rapid-fire rings in 3 seconds
        playRingtone(); // Immediate
        setTimeout(() => playRingtone(), 100);
        setTimeout(() => playRingtone(), 400);
        setTimeout(() => playRingtone(), 800);
        setTimeout(() => playRingtone(), 1200);
        setTimeout(() => playRingtone(), 1600);
        setTimeout(() => playRingtone(), 2000);
        setTimeout(() => playRingtone(), 2300);
        setTimeout(() => playRingtone(), 2600);
        setTimeout(() => playRingtone(), 3000);
      }
      
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
  }, [playRingtone, settings]);

  const testRingtone = useCallback(() => {
    playRingtone();
  }, [playRingtone]);

  // Initialize or update audio when settings change
  useEffect(() => {
    // Cleanup function must be defined here to avoid hook order issues
    const cleanup = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    };

    // Only proceed if enabled
    if (settings?.enabled === false) {
      cleanup();
      return cleanup;
    }

    // Use the selected ringtone type
    let ringtoneFile = '/phone-ringtone.mp3'; // default
    
    switch (settings?.type) {
      case 'notification-sound':
        ringtoneFile = '/notification-sound.mp3';
        break;
      case 'iphone-notification':
        ringtoneFile = '/iphone-notification.mp3';
        break;
      case 'samsung-notification':
        ringtoneFile = '/samsung-notification.mp3';
        break;
      case 'android-notification':
        ringtoneFile = '/android-notification.mp3';
        break;
      case 'classic-bell':
        ringtoneFile = '/classic-bell.mp3';
        break;
      case 'chimes-notification':
        ringtoneFile = '/chimes-notification.mp3';
        break;
      case 'phone-ringtone':
      default:
        ringtoneFile = '/phone-ringtone.mp3';
        break;
    }

    // Check if we need to create new audio or just update existing
    const needsNewAudio = !audioRef.current || currentRingtoneType.current !== (settings?.type || 'phone-ringtone');
    
    if (needsNewAudio) {
      // Cleanup existing audio first
      cleanup();
      
      // Create new audio element
      audioRef.current = new Audio(ringtoneFile);
      
      // Fix volume calculation - ensure it never exceeds 1.0
      const baseVolume = Math.min(settings?.volume || 0.8, 1.0);
      audioRef.current.volume = Math.min(baseVolume, 1.0); // Clamp to max 1.0
      
      audioRef.current.playbackRate = 1.2; // Faster playback for urgency
      audioRef.current.preload = 'auto';
      currentRingtoneType.current = settings?.type || 'phone-ringtone';
      
      console.log(`Audio initialized with ${ringtoneFile}, volume: ${audioRef.current.volume}`);
      
      // Setup Web Audio API for volume amplification after audio loads
      const setupWebAudio = () => {
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          
          if (audioContextRef.current && audioRef.current && !sourceNodeRef.current) {
            sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
            gainNodeRef.current = audioContextRef.current.createGain();
            
            // Use Web Audio API for amplification beyond 1.0
            const amplification = Math.min((settings?.volume || 0.8) * 3.0, 5.0); // Max 5x amplification
            gainNodeRef.current.gain.value = amplification;
            
            sourceNodeRef.current.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioContextRef.current.destination);
            console.log(`Web Audio API setup complete for ${ringtoneFile} with ${amplification}x amplification`);
          }
        } catch (error) {
          console.warn('Web Audio API setup failed, using standard audio:', error);
        }
      };
      
      // Setup Web Audio after audio loads
      audioRef.current.addEventListener('loadeddata', setupWebAudio, { once: true });
      audioRef.current.addEventListener('canplaythrough', setupWebAudio, { once: true });
      
      // Handle audio loading errors
      audioRef.current.addEventListener('error', (e) => {
        console.error(`Error loading ringtone audio ${ringtoneFile}:`, e);
      });
    } else if (audioRef.current && gainNodeRef.current) {
      // Just update volume if audio exists
      const baseVolume = Math.min(settings?.volume || 0.8, 1.0);
      audioRef.current.volume = Math.min(baseVolume, 1.0); // Clamp to max 1.0
      
      // Update Web Audio API gain if available
      const amplification = Math.min((settings?.volume || 0.8) * 3.0, 5.0);
      gainNodeRef.current.gain.value = amplification;
    }

    return cleanup;
  }, [settings]);

  return { playNotificationSound, testRingtone };
};