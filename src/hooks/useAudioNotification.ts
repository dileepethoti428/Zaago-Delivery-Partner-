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
    if (!audioRef.current) {
      console.warn('No audio element available for playback');
      return;
    }

    try {
      // Reset audio to beginning
      audioRef.current.currentTime = 0;
      
      // Resume audio context if suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Verify audio is ready for playback
      if (audioRef.current.readyState < 2) {
        console.warn('Audio not ready for playback, attempting fallback');
        throw new Error('Audio not ready');
      }
      
      // Play the ringtone
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('Ringtone played successfully');
      }
    } catch (error) {
      console.error('Error playing ringtone:', error);
      
      // Try fallback notification sound if main ringtone fails
      try {
        const fallbackAudio = new Audio('/notification-sound.mp3');
        fallbackAudio.volume = 1.0;
        await fallbackAudio.play();
        console.log('Fallback notification played successfully');
      } catch (fallbackError) {
        console.error('Fallback audio also failed:', fallbackError);
        
        // Last resort: vibration only
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([400, 100, 400, 100, 400]);
          console.log('Using vibration fallback');
        }
      }
    }
  }, []);

  const playNotificationSound = useCallback(async () => {
    // Don't play if disabled
    if (settings?.enabled === false) {
      console.log('Audio notifications disabled');
      return;
    }
    
    try {
      console.log('Playing notification sound with frequency:', settings?.frequency || 'double');
      
      // Ensure audio context is resumed (required by some browsers)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Play based on frequency setting
      const frequency = settings?.frequency || 'double';
      
      if (frequency === 'single') {
        await playRingtone();
      } else if (frequency === 'double') {
        await playRingtone();
        setTimeout(() => playRingtone(), 300);
      } else if (frequency === 'continuous') {
        // Continuous pattern: Extended pattern for critical delivery alerts
        console.log('Playing continuous notification pattern');
        await playRingtone(); // Immediate
        setTimeout(() => playRingtone(), 300);
        setTimeout(() => playRingtone(), 700);
        setTimeout(() => playRingtone(), 1200);
        setTimeout(() => playRingtone(), 1800);
        setTimeout(() => playRingtone(), 2500);
        setTimeout(() => playRingtone(), 3000);
        setTimeout(() => playRingtone(), 3500);
        setTimeout(() => playRingtone(), 4000);
        setTimeout(() => playRingtone(), 4500);
      }
      
      // Enhanced vibration pattern for mobile devices
      if (window.navigator && window.navigator.vibrate) {
        console.log('Triggering vibration pattern');
        // Immediate strong vibration
        window.navigator.vibrate([500, 150, 500, 150, 500]);
        // Follow-up vibrations for continuous alerts
        if (frequency === 'continuous') {
          setTimeout(() => {
            if (window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate([300, 100, 300, 100, 300]);
            }
          }, 2000);
          setTimeout(() => {
            if (window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate([400, 100, 400]);
            }
          }, 4000);
        }
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
      
      // Emergency fallback with vibration
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([1000, 200, 1000, 200, 1000]);
        console.log('Using emergency vibration fallback');
      }
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

    // Use proper ringtones instead of notification sounds
    let ringtoneFile = '/classic-phone-ring.mp3'; // Default to actual phone ringtone
    
    switch (settings?.type) {
      case 'rapido-ringtone':
        ringtoneFile = '/rapido-ringtone.mp3'; // Loud bell for Rapido style
        break;
      case 'classic-phone-ring':
        ringtoneFile = '/classic-phone-ring.mp3';
        break;
      case 'phone-ringtone':
        ringtoneFile = '/phone-ringtone.mp3';
        break;
      case 'iphone-ringtone':
        ringtoneFile = '/iphone-ringtone.mp3';
        break;
      case 'iphone-marimba':
        ringtoneFile = '/iphone-marimba.mp3';
        break;
      case 'iphone-opening':
        ringtoneFile = '/iphone-opening.mp3';
        break;
      case 'classic-bell':
        ringtoneFile = '/classic-bell.mp3';
        break;
      // High-volume custom ringtones
      case 'emergency-alarm':
        ringtoneFile = '/emergency-alarm.mp3';
        break;
      case 'air-horn':
        ringtoneFile = '/air-horn.mp3';
        break;
      case 'tornado-siren':
        ringtoneFile = '/tornado-siren.mp3';
        break;
      case 'ship-horn':
        ringtoneFile = '/ship-horn.mp3';
        break;
      // Keep notification sounds separate - these are shorter, quieter
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
      case 'chimes-notification':
        ringtoneFile = '/chimes-notification.mp3';
        break;
      default:
        ringtoneFile = '/classic-phone-ring.mp3'; // Always default to proper ringtone
        break;
    }

    // Check if we need to create new audio or just update existing
    const needsNewAudio = !audioRef.current || currentRingtoneType.current !== (settings?.type || 'phone-ringtone');
    
    if (needsNewAudio) {
      // Cleanup existing audio first
      cleanup();
      
      // Create new audio element
      audioRef.current = new Audio(ringtoneFile);
      
      console.log(`Initializing audio with file: ${ringtoneFile}`);
      
      // Set maximum volume for ringtones
      const baseVolume = settings?.volume || 1.0;
      audioRef.current.volume = 1.0; // Always max volume for ringtones
      
      audioRef.current.playbackRate = 1.2; // Faster playback for urgency
      audioRef.current.preload = 'auto';
      currentRingtoneType.current = settings?.type || 'phone-ringtone';
      
      // Add comprehensive error handling
      audioRef.current.addEventListener('error', (e) => {
        console.error(`Error loading ringtone audio ${ringtoneFile}:`, e);
        console.warn('Attempting to use fallback notification sound');
        
        // Try to load fallback sound
        try {
          const fallbackAudio = new Audio('/notification-sound.mp3');
          fallbackAudio.volume = 1.0;
          fallbackAudio.preload = 'auto';
          audioRef.current = fallbackAudio;
          console.log('Successfully loaded fallback notification sound');
        } catch (fallbackError) {
          console.error('Fallback audio also failed to load:', fallbackError);
        }
      });
      
      // Add success logging
      audioRef.current.addEventListener('loadeddata', () => {
        console.log(`Audio loaded successfully: ${ringtoneFile}, duration: ${audioRef.current?.duration}s`);
      });
      
      audioRef.current.addEventListener('canplaythrough', () => {
        console.log(`Audio ready for playback: ${ringtoneFile}`);
      });
      
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
            
            // Use Web Audio API for maximum amplification for iPhone ringtones
            const amplification = Math.min((settings?.volume || 1.0) * 4.0, 6.0); // Max 6x amplification for iPhone
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
      audioRef.current.volume = 1.0; // Always max volume for ringtones
      
      // Update Web Audio API gain for maximum amplification
      const amplification = Math.min((settings?.volume || 1.0) * 4.0, 6.0);
      gainNodeRef.current.gain.value = amplification;
    }

    return cleanup;
  }, [settings]);

  return { playNotificationSound, testRingtone };
};