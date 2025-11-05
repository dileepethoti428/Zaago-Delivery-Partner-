export type GeoPoint = {
  lat: number;
  lng: number;
};

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function getDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  
  return R * y;
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

/**
 * Reverse geocode coordinates to a human-readable location
 * Uses OpenStreetMap Nominatim (best-effort, may fail)
 */
export async function reverseGeocode(p: GeoPoint): Promise<string | null> {
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
      return null;
    }

    const data = await response.json();
    
    // Build a short label from the address components
    const address = data.address;
    if (!address) return null;

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

    return parts.length > 0 ? parts.join(', ') : null;
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return null;
  }
}
