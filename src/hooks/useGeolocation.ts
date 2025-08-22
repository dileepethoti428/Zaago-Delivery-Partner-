import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  address: string | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  saveToBackend?: boolean;
  refreshInterval?: number;
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 60000,
    saveToBackend = false,
    refreshInterval = 10000, // 10 seconds
  } = options;

  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
    address: null,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  // Reverse geocoding to get address from coordinates
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=pk.eyJ1IjoiemFhZ28tZGVsaXZlcnkiLCJhIjoiY2w5cHF3eXdxMDNxazNvbzltb2pzeWdxbSJ9.xxx&types=address,poi`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].place_name;
        }
      }
    } catch (error) {
      console.warn('Failed to get address from coordinates:', error);
    }
    
    // Fallback to basic lat/lng display
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Save location to backend
  const saveLocationToBackend = async (lat: number, lng: number, accuracy: number | null) => {
    try {
      // Get current agent info
      const agentEmail = localStorage.getItem('agent_email') || 
        (await supabase.auth.getUser()).data.user?.email;
      
      if (!agentEmail) return;

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', agentEmail)
        .eq('is_active', true)
        .maybeSingle();

      if (!agent) return;

      // Insert location record
      const { error } = await supabase
        .from('driver_locations')
        .insert({
          agent_id: agent.id,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          recorded_at: new Date().toISOString(),
          is_active: true,
        });

      if (error) {
        console.error('Failed to save location to backend:', error);
      }
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    // Get address
    const address = await getAddressFromCoordinates(latitude, longitude);
    
    setLocation({
      latitude,
      longitude,
      accuracy,
      error: null,
      loading: false,
      address,
    });

    // Save to backend if enabled
    if (saveToBackend) {
      await saveLocationToBackend(latitude, longitude, accuracy);
    }
  }, [saveToBackend]);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Unknown location error';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied. Please enable location permissions.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
    }

    setLocation(prev => ({
      ...prev,
      error: errorMessage,
      loading: false,
    }));
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser.',
        loading: false,
      }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [updateLocation, handleError, enableHighAccuracy, timeout, maximumAge]);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    setWatchId(id);
    return id;
  }, [updateLocation, handleError, enableHighAccuracy, timeout, maximumAge]);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [watchId]);

  // Start location tracking on mount
  useEffect(() => {
    getCurrentLocation();

    // Set up periodic refresh if specified
    let intervalId: NodeJS.Timeout | null = null;
    
    if (refreshInterval > 0) {
      intervalId = setInterval(() => {
        getCurrentLocation();
      }, refreshInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      stopWatching();
    };
  }, [getCurrentLocation, refreshInterval, stopWatching]);

  return {
    ...location,
    getCurrentLocation,
    startWatching,
    stopWatching,
    refresh: getCurrentLocation,
  };
};