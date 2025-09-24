import { supabase } from "@/integrations/supabase/client";

// Haversine formula for fallback distance calculation
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

interface DistanceResult {
  distance_km: number;
  eta_mins: number;
  source: 'realtime' | 'cached' | 'fallback';
}

export async function calculateRealTimeDistance(
  agentLocation: { lat: number; lng: number },
  customerLocation: { lat: number; lng: number },
  orderId?: string
): Promise<DistanceResult> {
  
  console.log('🚚 Calculating real-time distance:', { agentLocation, customerLocation, orderId });

  try {
    // Try to get real-time distance from edge function
    const { data, error } = await supabase.functions.invoke('calculate-distance-eta', {
      body: {
        origin: { lat: agentLocation.lat, lng: agentLocation.lng },
        destination: { lat: customerLocation.lat, lng: customerLocation.lng }
      }
    });

    if (!error && data?.success && data?.distance_km > 0) {
      console.log('✅ Real-time distance calculated:', data.distance_km, 'km');
      return {
        distance_km: data.distance_km,
        eta_mins: data.eta_mins || Math.ceil(data.distance_km * 2),
        source: 'realtime'
      };
    }

    console.warn('⚠️ Edge function failed, using Haversine fallback:', error);
  } catch (err) {
    console.warn('⚠️ Error calling distance service:', err);
  }

  // Fallback to Haversine calculation
  const fallbackDistance = calculateHaversineDistance(
    agentLocation.lat, 
    agentLocation.lng,
    customerLocation.lat, 
    customerLocation.lng
  );

  console.log('📐 Using Haversine fallback:', fallbackDistance.toFixed(2), 'km');
  
  return {
    distance_km: Math.round(fallbackDistance * 10) / 10, // Round to 1 decimal
    eta_mins: Math.ceil(fallbackDistance * 2), // 2 minutes per km
    source: 'fallback'
  };
}

export function getAgentLocationFromStorage(): { lat: number; lng: number } | null {
  try {
    const stored = localStorage.getItem('agentLocation');
    if (stored) {
      const location = JSON.parse(stored);
      if (location.lat && location.lng) {
        return location;
      }
    }
  } catch (error) {
    console.warn('Error getting agent location from storage:', error);
  }
  return null;
}

export function extractCoordinatesFromAddress(address: any): { lat: number; lng: number } | null {
  if (!address) return null;
  
  // Try different coordinate formats
  if (address.coordinates && address.coordinates.lat && address.coordinates.lng) {
    return { lat: address.coordinates.lat, lng: address.coordinates.lng };
  }
  
  if (address.lat && address.lng) {
    return { lat: address.lat, lng: address.lng };
  }
  
  if (address.latitude && address.longitude) {
    return { lat: address.latitude, lng: address.longitude };
  }
  
  return null;
}