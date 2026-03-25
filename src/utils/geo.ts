export type GeoPoint = {
  lat: number;
  lng: number;
};

import { getCachedDistance, setCachedDistance } from './computationCache';

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function getDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const cached = getCachedDistance(a.lat, a.lng, b.lat, b.lng);
  if (cached !== null) return cached;

  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  
  const distance = R * y;
  setCachedDistance(a.lat, a.lng, b.lat, b.lng, distance);
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format coordinates to 5 decimal precision
 */
export function formatCoords(p: GeoPoint): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

/**
 * Check if browser supports geolocation
 */
export function canUseGeolocation(): boolean {
  return 'geolocation' in navigator;
}

const GEOCODE_CACHE_KEY = 'zaago_geocode_cache';
const GEOCODE_CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const GEOCODE_DISTANCE_THRESHOLD_KM = 0.5; // 500 meters

type GeocodeCache = {
  lat: number;
  lng: number;
  label: string;
  timestamp: number;
};

function getGeocodeCache(): GeocodeCache | null {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeocodeCache;
  } catch {
    return null;
  }
}

function setGeocodeCache(lat: number, lng: number, label: string) {
  try {
    const cache: GeocodeCache = { lat, lng, label, timestamp: Date.now() };
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Reverse geocode coordinates to a human-readable location
 * Uses OpenStreetMap Nominatim with 24h localStorage cache and 500m distance threshold
 */
export async function reverseGeocode(p: GeoPoint): Promise<string | null> {
  // Check cache first
  const cached = getGeocodeCache();
  if (cached) {
    const age = Date.now() - cached.timestamp;
    const dist = getDistanceKm({ lat: cached.lat, lng: cached.lng }, p);
    if (age < GEOCODE_CACHE_TTL_MS && dist < GEOCODE_DISTANCE_THRESHOLD_KM) {
      console.log('[Geocode] Cache hit, skipping API call');
      return cached.label;
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}`,
      {
        headers: {
          'User-Agent': 'ZaagoDeliveryAgent/1.0',
        },
      }
    );

    if (!response.ok) {
      console.warn('Reverse geocode failed:', response.status);
      return cached?.label ?? null;
    }

    const data = await response.json();
    
    // Build a short label from the address components
    const address = data.address;
    if (!address) return cached?.label ?? null;

    const parts: string[] = [];
    
    // Try to get city/town/village
    const locality = address.city || address.town || address.village || address.suburb;
    if (locality) parts.push(locality);
    
    // Add state/province if available
    if (address.state) parts.push(address.state);
    
    // If we have nothing, try country
    if (parts.length === 0 && address.country) {
      parts.push(address.country);
    }

    const label = parts.length > 0 ? parts.join(', ') : null;
    
    // Save to cache
    if (label) {
      setGeocodeCache(p.lat, p.lng, label);
    }

    return label;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return cached?.label ?? null;
  }
}
