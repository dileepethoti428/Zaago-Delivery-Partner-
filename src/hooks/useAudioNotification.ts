import { useCallback, useRef, useEffect } from 'react';

interface RingtoneSettings {
  enabled: boolean;
  volume: number;
  type: string;
  frequency: string;
}

export const useAudioNotification = (settings?: RingtoneSettings) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const playRingtone = useCallback(async () => {
    console.log('🔊 playRingtone called');
    
    if (!audioRef.current) {
      console.warn('🔊 No audio element available for playback');
      return;
    }

    try {
      console.log('🔊 Audio element details:', {
        src: audioRef.current.src,
        readyState: audioRef.current.readyState,
        volume: audioRef.current.volume,
        muted: audioRef.current.muted,
        paused: audioRef.current.paused
      });

      // Reset audio to beginning
      audioRef.current.currentTime = 0;
      
      // Resume audio context if suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('🔊 Resuming audio context...');
        await audioContextRef.current.resume();
      }
      
      // Verify audio is ready for playback
      if (audioRef.current.readyState < 2) {
        console.warn('🔊 Audio not ready for playback, readyState:', audioRef.current.readyState);
        // Try to load the audio
        audioRef.current.load();
        
        // Wait for audio to be ready with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error('🔊 Audio loading timeout');
            reject(new Error('Audio loading timeout'));
          }, 5000);
          
          audioRef.current!.addEventListener('canplay', () => {
            clearTimeout(timeout);
            resolve(undefined);
          }, { once: true });
          
          audioRef.current!.addEventListener('error', (e) => {
            clearTimeout(timeout);
            reject(e);
          }, { once: true });
        });
      }
      
      console.log('🔊 Attempting to play audio...');
      
      // Play the ringtone
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('🔊 Ringtone played successfully');
      }
    } catch (error) {
      console.error('🔊 Error playing ringtone:', error);
      
      // Try fallback notification sound if main ringtone fails
      try {
        console.log('🔊 Trying fallback notification sound...');
        const fallbackAudio = new Audio('/iphone-6-original-ringtone.mp3');
        fallbackAudio.volume = 1.0;
        await fallbackAudio.play();
        console.log('🔊 Fallback notification played successfully');
      } catch (fallbackError) {
        console.error('🔊 Fallback audio also failed:', fallbackError);
        
        // Last resort: vibration only
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate([400, 100, 400, 100, 400]);
          console.log('🔊 Using vibration fallback');
        }
      }
    }
  }, []);

  const playNotificationSound = useCallback(async () => {
    console.log('🔊 playNotificationSound called with settings:', settings);
    
    // Don't play if disabled
    if (settings?.enabled === false) {
      console.log('🔊 Audio notifications disabled in settings');
      return;
    }
    
    if (!audioRef.current) {
      console.error('🔊 No audio element available');
      return;
    }
    
    try {
      console.log('🔊 Playing notification sound with frequency:', settings?.frequency || 'double');
      console.log('🔊 Audio element state:', {
        readyState: audioRef.current.readyState,
        paused: audioRef.current.paused,
        volume: audioRef.current.volume,
        src: audioRef.current.src
      });
      
      // Ensure audio context is resumed (required by some browsers)
      if (audioContextRef.current) {
        console.log('🔊 Audio context state:', audioContextRef.current.state);
        if (audioContextRef.current.state === 'suspended') {
          console.log('🔊 Resuming suspended audio context...');
          await audioContextRef.current.resume();
          console.log('🔊 Audio context resumed:', audioContextRef.current.state);
        }
      }
      
      // Check if audio is ready to play
      if (audioRef.current.readyState < 2) {
        console.log('🔊 Audio not ready, loading first...');
        audioRef.current.load();
        
        // Wait for audio to be ready with timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.warn('🔊 Audio loading timeout after 3 seconds');
            resolve(undefined); // Continue anyway
          }, 3000);
          
          audioRef.current!.addEventListener('canplay', () => {
            clearTimeout(timeout);
            console.log('🔊 Audio ready to play');
            resolve(undefined);
          }, { once: true });
          
          audioRef.current!.addEventListener('error', (e) => {
            clearTimeout(timeout);
            console.error('🔊 Audio loading error:', e);
            reject(e);
          }, { once: true });
        });
      }
      
      // Play based on frequency setting
      const frequency = settings?.frequency || 'double';
      
      if (frequency === 'single') {
        await playRingtone();
      } else if (frequency === 'double') {
        await playRingtone();
        const timeout1 = setTimeout(() => playRingtone(), 300);
        timeoutsRef.current.push(timeout1);
      } else if (frequency === 'continuous') {
        // Continuous pattern: Extended pattern for critical delivery alerts
        console.log('🔊 Playing continuous notification pattern');
        await playRingtone(); // Immediate
        const timeout1 = setTimeout(() => playRingtone(), 300);
        const timeout2 = setTimeout(() => playRingtone(), 700);
        const timeout3 = setTimeout(() => playRingtone(), 1200);
        const timeout4 = setTimeout(() => playRingtone(), 1800);
        const timeout5 = setTimeout(() => playRingtone(), 2500);
        timeoutsRef.current.push(timeout1, timeout2, timeout3, timeout4, timeout5);
      } else {
        // Default to double for any unknown frequency
        await playRingtone();
        const timeout1 = setTimeout(() => playRingtone(), 300);
        timeoutsRef.current.push(timeout1);
      }
      
      // Enhanced vibration pattern for mobile devices
      if (window.navigator && window.navigator.vibrate) {
        console.log('🔊 Triggering vibration pattern');
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
      console.error('🔊 Error playing notification sound:', error);
      
      // Emergency fallback with vibration
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([1000, 200, 1000, 200, 1000]);
        console.log('🔊 Using emergency vibration fallback');
      }
    }
  }, [playRingtone, settings]);

  const stopRingtone = useCallback(() => {
    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
    
    // Stop audio playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    console.log('🔊 Ringtone stopped and timeouts cleared');
  }, []);

  const testRingtone = useCallback(() => {
    console.log('🔊 Testing ringtone...');
    playRingtone();
  }, [playRingtone]);

  // Initialize and manage audio element and Web Audio API
  useEffect(() => {
    console.log('🔊 Initializing audio with settings:', settings);
    
    const cleanup = () => {
      // Clear any pending timeouts
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current = [];
      
      // Cleanup audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
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
    let ringtoneFile = '/iphone-6-original-ringtone.mp3'; // Default to custom iPhone 6 original ringtone
    
    switch (settings?.type) {
      case 'rapido-ringtone':
        ringtoneFile = '/rapido-ringtone.mp3';
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
      case 'iphone-6-ringtone':
        ringtoneFile = '/iphone-6-original-ringtone.mp3';
        break;
      case 'tornado-siren':
        ringtoneFile = '/tornado-siren.mp3';
        break;
      case 'ship-horn':
        ringtoneFile = '/ship-horn.mp3';
        break;
      case 'air-horn':
        ringtoneFile = '/air-horn.mp3';
        break;
      case 'emergency-alarm':
        ringtoneFile = '/emergency-alarm.mp3';
        break;
      case 'chimes-notification':
        ringtoneFile = '/chimes-notification.mp3';
        break;
      case 'classic-bell':
        ringtoneFile = '/classic-bell.mp3';
        break;
      case 'android-notification':
        ringtoneFile = '/android-notification.mp3';
        break;
      case 'iphone-notification':
        ringtoneFile = '/iphone-notification.mp3';
        break;
      case 'samsung-notification':
        ringtoneFile = '/samsung-notification.mp3';
        break;
      case 'notification-sound':
        ringtoneFile = '/notification-sound.mp3';
        break;
      default:
        ringtoneFile = '/iphone-6-original-ringtone.mp3';
    }

    console.log('🔊 Selected ringtone file:', ringtoneFile);

    try {
      // Create new audio element
      audioRef.current = new Audio(ringtoneFile);
      audioRef.current.preload = 'auto';
      audioRef.current.volume = Math.min(settings?.volume || 0.9, 1.0);
      
      // Add event listeners for debugging
      audioRef.current.addEventListener('loadstart', () => console.log('🔊 Audio load started'));
      audioRef.current.addEventListener('canplay', () => console.log('🔊 Audio can play'));
      audioRef.current.addEventListener('canplaythrough', () => console.log('🔊 Audio can play through'));
      audioRef.current.addEventListener('error', (e) => console.error('🔊 Audio error:', e));
      audioRef.current.addEventListener('ended', () => console.log('🔊 Audio ended'));
      
      // Initialize Web Audio API for potential amplification
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          console.log('🔊 Audio context created:', audioContextRef.current.state);
          
          // Create audio graph: source -> gain -> destination
          sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          gainNodeRef.current = audioContextRef.current.createGain();
          
          // Connect nodes
          sourceNodeRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
          
          // Set initial gain
          const amplification = Math.min((settings?.volume || 0.9) * 2.0, 2.0);
          gainNodeRef.current.gain.value = amplification;
          
          console.log('🔊 Web Audio API graph created with amplification:', amplification);
        } catch (audioContextError) {
          console.warn('🔊 Web Audio API not available:', audioContextError);
        }
      }
      
      // Load the audio
      audioRef.current.load();
      
    } catch (error) {
      console.error('🔊 Error setting up audio:', error);
    }

    if (audioRef.current) {
      // Just update volume if audio exists
      audioRef.current.volume = settings?.volume || 0.9;
      
      // Update Web Audio API gain for amplification
      if (gainNodeRef.current) {
        const amplification = Math.min((settings?.volume || 0.9) * 2.0, 2.0);
        gainNodeRef.current.gain.value = amplification;
      }
    }

    return cleanup;
  }, [settings]);

  return { playNotificationSound, testRingtone, stopRingtone };
};

export type { RingtoneSettings };