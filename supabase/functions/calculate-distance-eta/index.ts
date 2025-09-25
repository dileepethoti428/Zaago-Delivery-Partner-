import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Haversine formula to calculate distance between two points
function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
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
          message: 'Please provide origin and destination with lat/lng values'
        }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Get Mapbox token from environment
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN')
    
    let distance_km = 0
    let eta_mins = 0
    let source = 'fallback'

    if (mapboxToken) {
      try {
        // Try Mapbox Directions API first
        const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?access_token=${mapboxToken}&geometries=geojson`
        
        const mapboxResponse = await fetch(mapboxUrl)
        const mapboxData = await mapboxResponse.json()
        
        if (mapboxData.routes && mapboxData.routes.length > 0) {
          const route = mapboxData.routes[0]
          distance_km = (route.distance / 1000) // Convert meters to km
          
          // Handle very short distances - set minimum practical values
          if (distance_km < 0.01) { // Less than 10 meters
            distance_km = 0.01 // Set minimum 10m for practical purposes
            eta_mins = 1 // Minimum 1 minute
          } else {
            eta_mins = Math.max(1, Math.ceil(distance_km * 2)) // Minimum 1 min, 2 min per km
          }
          
          source = 'mapbox'
          
          console.log('Mapbox route found:', { 
            original_distance: route.distance, 
            distance_km, 
            eta_mins, 
            very_close: route.distance < 10 
          })
        } else {
          throw new Error('No routes found from Mapbox')
        }
      } catch (mapboxError) {
        console.log('Mapbox failed, using fallback:', mapboxError instanceof Error ? mapboxError.message : 'Unknown error')
        // Fall back to Haversine calculation
        distance_km = calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng)
        
        // Handle very short distances for fallback too
        if (distance_km < 0.01) {
          distance_km = 0.01
          eta_mins = 1
        } else {
          eta_mins = Math.max(1, Math.ceil(distance_km * 2)) // Minimum 1 min, 2 min per km
        }
        
        source = 'fallback'
      }
    } else {
      console.log('No Mapbox token, using Haversine fallback')
      // Use Haversine distance if no Mapbox token
      distance_km = calculateHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng)
      
      // Handle very short distances for Haversine too
      if (distance_km < 0.01) {
        distance_km = 0.01
        eta_mins = 1
      } else {
        eta_mins = Math.max(1, Math.ceil(distance_km * 2)) // Minimum 1 min, 2 min per km
      }
      
      source = 'fallback'
    }

    return new Response(
      JSON.stringify({ 
        distance_km: Math.round(distance_km * 10) / 10, // Round to 1 decimal
        eta_mins,
        source,
        success: true 
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Error in calculate-distance-eta:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to calculate distance',
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})