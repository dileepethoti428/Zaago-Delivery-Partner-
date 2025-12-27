import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Zepto/Blinkit style distance calculation
 * - Uses Mapbox Directions API for ROAD ROUTE distance (no Haversine fallback)
 * - Rounds UP to 1 decimal place (ceil)
 */
async function calculateRoadDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mapboxToken: string
): Promise<{ distance_km: number; eta_mins: number; success: boolean; error?: string }> {
  try {
    const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${mapboxToken}&geometries=geojson`;
    
    const response = await fetch(mapboxUrl);
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      console.error('Mapbox returned no routes:', data);
      return { 
        distance_km: 0, 
        eta_mins: 0, 
        success: false, 
        error: 'No route found between locations' 
      };
    }
    
    const route = data.routes[0];
    const distanceMeters = route.distance;
    const durationSeconds = route.duration;
    
    // Convert meters to km
    const rawDistanceKm = distanceMeters / 1000;
    
    // Zepto style: Round UP to 1 decimal place (ceil)
    const roundedDistanceKm = Math.ceil(rawDistanceKm * 10) / 10;
    
    // Minimum distance of 0.1 km
    const finalDistanceKm = Math.max(0.1, roundedDistanceKm);
    
    // ETA in minutes (minimum 1 minute)
    const etaMins = Math.max(1, Math.ceil(durationSeconds / 60));
    
    console.log('✅ Mapbox road distance calculated:', {
      raw_meters: distanceMeters,
      raw_km: rawDistanceKm,
      rounded_km: finalDistanceKm,
      eta_mins: etaMins
    });
    
    return {
      distance_km: finalDistanceKm,
      eta_mins: etaMins,
      success: true
    };
  } catch (error) {
    console.error('Mapbox API error:', error);
    return {
      distance_km: 0,
      eta_mins: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Mapbox API failed'
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { origin, destination } = await req.json()
    
    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required coordinates',
          message: 'Please provide origin and destination with lat/lng values',
          success: false
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get Mapbox token from environment
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    if (!mapboxToken) {
      console.error('❌ MAPBOX_PUBLIC_TOKEN not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Routing service not configured',
          message: 'MAPBOX_PUBLIC_TOKEN environment variable is required for road distance calculation',
          success: false
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate road distance using Mapbox Directions API
    const result = await calculateRoadDistance(origin, destination, mapboxToken);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to calculate road distance',
          message: result.error || 'Mapbox Directions API returned no routes',
          success: false
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        distance_km: result.distance_km,
        eta_mins: result.eta_mins,
        source: 'mapbox_road',
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Error in calculate-distance-eta:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to calculate distance',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
