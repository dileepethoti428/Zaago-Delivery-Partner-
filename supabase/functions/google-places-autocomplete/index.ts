import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlacePrediction {
  description: string;
  matched_substrings: Array<{
    length: number;
    offset: number;
  }>;
  place_id: string;
  reference: string;
  structured_formatting: {
    main_text: string;
    main_text_matched_substrings: Array<{
      length: number;
      offset: number;
    }>;
    secondary_text: string;
  };
  terms: Array<{
    offset: number;
    value: string;
  }>;
  types: string[];
}

interface AutocompleteResponse {
  predictions: PlacePrediction[];
  status: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input, location, radius = 50000, types = "geocode", language = "en", components = "country:in" } = await req.json();
    
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

    if (!input || input.trim().length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          predictions: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const params = new URLSearchParams({
      input: input.trim(),
      key: GOOGLE_PLACES_API_KEY,
      types: types,
      language: language,
      components: components
    });

    // Add location bias if provided
    if (location && location.lat && location.lng) {
      params.append('location', `${location.lat},${location.lng}`);
      params.append('radius', radius.toString());
    }

    const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    
    const response = await fetch(apiUrl);
    const data: AutocompleteResponse = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
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

    const predictions = data.predictions || [];
    
    return new Response(
      JSON.stringify({ 
        success: true,
        predictions: predictions.map(prediction => ({
          place_id: prediction.place_id,
          description: prediction.description,
          main_text: prediction.structured_formatting.main_text,
          secondary_text: prediction.structured_formatting.secondary_text,
          types: prediction.types
        }))
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in google-places-autocomplete function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});