import { supabase } from "@/integrations/supabase/client";

// Cache for coordinate-to-address mappings
interface AddressCache {
  [key: string]: {
    address: string;
    timestamp: number;
  };
}

const CACHE_KEY = 'address_cache';
const CACHE_EXPIRY_DAYS = 7;

// Get cache from localStorage
const getCache = (): AddressCache => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

// Save cache to localStorage
const saveCache = (cache: AddressCache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to save address cache:', error);
  }
};

// Check if cache entry is expired
const isCacheExpired = (timestamp: number): boolean => {
  const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - timestamp > expiryMs;
};

// Extract coordinates from various address formats
export const extractCoordinatesFromAddress = (address: any): { lat: number; lng: number } | null => {
  if (!address) return null;

  // If address is already coordinate object
  if (typeof address === 'object' && address.lat && address.lng) {
    return { lat: parseFloat(address.lat), lng: parseFloat(address.lng) };
  }

  // If address is an object with coordinates property
  if (typeof address === 'object' && address.coordinates) {
    const coords = address.coordinates;
    if (coords.lat && coords.lng) {
      return { lat: parseFloat(coords.lat), lng: parseFloat(coords.lng) };
    }
  }

  // If address is a string that looks like coordinates
  if (typeof address === 'string') {
    const coordMatch = address.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/);
    if (coordMatch) {
      const [lat, lng] = address.split(',').map(s => parseFloat(s.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
};

// Reverse geocode coordinates to human-readable address
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('google-places-geocode', {
      body: { lat, lng }
    });

    if (error) throw error;

    if (data?.success && data?.address) {
      return data.address;
    }

    throw new Error('No address found');
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return a fallback formatted coordinate string
    return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// Main function to format any location to a human-readable address
export const formatLocationToAddress = async (location: any): Promise<string> => {
  // If already a formatted string address (not coordinates)
  if (typeof location === 'string' && !location.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
    return location;
  }

  // Extract coordinates if present
  const coords = extractCoordinatesFromAddress(location);
  
  if (!coords) {
    // If we can't find coordinates, try to extract address string from object
    if (typeof location === 'object') {
      if (location.full_address) return location.full_address;
      if (location.address) return typeof location.address === 'string' ? location.address : 'Address not available';
      if (location.addressLine1) {
        const parts = [
          location.addressLine1,
          location.addressLine2,
          location.city,
          location.state,
          location.pincode
        ].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
    }
    return 'Address not available';
  }

  // Check cache first
  const cacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  const cache = getCache();
  
  if (cache[cacheKey] && !isCacheExpired(cache[cacheKey].timestamp)) {
    console.log('📍 Using cached address for:', cacheKey);
    return cache[cacheKey].address;
  }

  // Fetch from reverse geocoding API
  console.log('🌍 Reverse geocoding:', cacheKey);
  const address = await reverseGeocode(coords.lat, coords.lng);
  
  // Cache the result
  cache[cacheKey] = {
    address,
    timestamp: Date.now()
  };
  saveCache(cache);
  
  return address;
};

// Synchronous version that returns coordinates as fallback
export const formatLocationToAddressSync = (location: any): string => {
  // If already a formatted string address
  if (typeof location === 'string' && !location.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
    return location;
  }

  // Extract coordinates if present
  const coords = extractCoordinatesFromAddress(location);
  
  if (!coords) {
    // Try to extract address string from object
    if (typeof location === 'object') {
      if (location.full_address) return location.full_address;
      if (location.address) return typeof location.address === 'string' ? location.address : 'Address not available';
      if (location.addressLine1) {
        const parts = [
          location.addressLine1,
          location.addressLine2,
          location.city,
          location.state,
          location.pincode
        ].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
    }
    return 'Address not available';
  }

  // Check cache
  const cacheKey = `${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`;
  const cache = getCache();
  
  if (cache[cacheKey] && !isCacheExpired(cache[cacheKey].timestamp)) {
    return cache[cacheKey].address;
  }

  // Return formatted coordinates if not in cache
  return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
};
