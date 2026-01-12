import { useLocationStore } from '@/store/location';

/**
 * Cross-platform location permission check
 * Works with both Web/PWA and Median.co native apps
 */
export async function checkLocationPermission(): Promise<boolean> {
  // Check if running in Median.co native app
  if (typeof window !== 'undefined' && (window as any).median?.geolocation) {
    try {
      console.log('[Location] Checking Median.co permission...');
      const result = await (window as any).median.geolocation.requestPermission();
      console.log('[Location] Median.co permission result:', result);
      return result === 'granted' || result === true;
    } catch (error) {
      console.error('[Location] Median permission check failed:', error);
      return false;
    }
  }
  
  // Web/PWA - use existing location store
  const state = useLocationStore.getState();
  
  // If already granted, return true
  if (state.permission === 'granted') {
    return true;
  }
  
  // If denied, return false
  if (state.permission === 'denied') {
    return false;
  }
  
  // If prompt or unknown, try to get current position to trigger permission
  try {
    await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
    return true;
  } catch (error) {
    console.error('[Location] Permission request failed:', error);
    return false;
  }
}
