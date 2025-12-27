import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Zepto/Blinkit style distance calculation
 * - Uses Google Distance Matrix API for ROAD ROUTE distance
 * - Rounds UP to 1 decimal place (ceil)
 */
async function calculateRoadDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  googleApiKey: string
): Promise<{ distance_km: number; eta_mins: number; success: boolean; error?: string }> {
  try {
    const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${googleApiKey}`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    if (data.status !== 'OK') {
      console.error('Google Distance Matrix API error:', data.status, data.error_message);
      return { 
        distance_km: 0, 
        eta_mins: 0, 
        success: false, 
        error: data.error_message || data.status 
      };
    }
    
    if (!data.rows?.[0]?.elements?.[0]) {
      console.error('Google returned no route data:', data);
      return { 
        distance_km: 0, 
        eta_mins: 0, 
        success: false, 
        error: 'No route found between locations' 
      };
    }
    
    const element = data.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      console.error('Google element status error:', element.status);
      return { 
        distance_km: 0, 
        eta_mins: 0, 
        success: false, 
        error: element.status 
      };
    }
    
    const distanceMeters = element.distance.value;
    const durationSeconds = element.duration.value;
    
    // Convert meters to km
    const rawDistanceKm = distanceMeters / 1000;
    
    // Zepto style: Round UP to 1 decimal place (ceil)
    const roundedDistanceKm = Math.ceil(rawDistanceKm * 10) / 10;
    
    // Minimum distance of 0.1 km
    const finalDistanceKm = Math.max(0.1, roundedDistanceKm);
    
    // ETA in minutes (minimum 1 minute)
    const etaMins = Math.max(1, Math.ceil(durationSeconds / 60));
    
    console.log('✅ Google road distance calculated:', {
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
    console.error('Google Distance Matrix API error:', error);
    return {
      distance_km: 0,
      eta_mins: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Google API failed'
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

    // Get Google API key from environment
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    
    if (!googleApiKey) {
      console.error('❌ GOOGLE_PLACES_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Routing service not configured',
          message: 'GOOGLE_PLACES_API_KEY environment variable is required for road distance calculation',
          success: false
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Calculate road distance using Google Distance Matrix API
    const result = await calculateRoadDistance(origin, destination, googleApiKey);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Failed to calculate road distance',
          message: result.error || 'Google Distance Matrix API returned no routes',
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
        source: 'google_road',
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
