import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
  name?: string;
  types: string[];
}

interface GeocodeResponse {
  results: PlaceResult[];
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📍 Geocode function called - Method:', req.method);
    const body = await req.json();
    console.log('📍 Request body:', JSON.stringify(body));
    
    const { lat, lng, address, placeId } = body;
    
    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!GOOGLE_PLACES_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Places API key not configured',
          success: false 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let apiUrl = '';
    let params = new URLSearchParams({
      key: GOOGLE_PLACES_API_KEY
    });

    // Reverse geocoding (coordinates to address)
    if (lat && lng) {
      params.append('latlng', `${lat},${lng}`);
      apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
    }
    // Forward geocoding (address to coordinates) 
    else if (address) {
      params.append('address', address);
      apiUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
    }
    // Place details by place ID
    else if (placeId) {
      const detailsParams = new URLSearchParams({
        place_id: placeId,
        key: GOOGLE_PLACES_API_KEY,
        fields: 'formatted_address,geometry,name,place_id,types'
      });
      apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams}`;
    }
    else {
      return new Response(
        JSON.stringify({ 
          error: 'Either coordinates (lat, lng), address, or placeId must be provided',
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('📍 Calling Google API:', apiUrl);
    const response = await fetch(apiUrl);
    const data: GeocodeResponse = await response.json();
    console.log('📍 Google API response status:', data.status);

    if (data.status !== 'OK') {
      console.error('❌ Google API error:', data.status);
      return new Response(
        JSON.stringify({ 
          error: `Google Places API error: ${data.status}`,
          success: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = placeId ? (data as any).result : data.results[0];
    console.log('📍 Result found:', result ? 'Yes' : 'No');
    
    if (!result) {
      return new Response(
        JSON.stringify({ 
          error: 'No results found',
          success: false 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const responseData = { 
      success: true,
      address: result.formatted_address,
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      },
      place_id: result.place_id,
      name: result.name,
      types: result.types || []
    };
    
    console.log('✅ Returning address:', result.formatted_address);
    
    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in google-places-geocode function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});