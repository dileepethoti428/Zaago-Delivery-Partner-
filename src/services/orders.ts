// Order fetching services - DISPLAY ONLY (no local calculations)
import { supabase } from '@/integrations/supabase/client';
import { parsePoint, GeoPoint } from '@/utils/coords';

export type DbOrderRow = {
  id: string;
  status?: string | null;
  total?: number | null;
  address?: any | null;
  pickup_address?: string | null;
  pickup_location?: any | null;
  delivery_address_id?: string | null;
  customer_name?: string | null;
  created_at?: string | null;
  delivery_addresses?: { 
    id: string; 
    coordinates?: any | null; 
    full_address?: string | null;
    address_line?: string | null;
  } | null;
};

export type ZaagoOrder = {
  id: string;
  pickup: string;
  drop: string;
  pickupCoord: GeoPoint | null;
  etaMin: number;
  payout: number;
  status: 'new' | 'open' | 'accepted' | 'picked' | 'picked_up' | 'delivered' | 'canceled' | 'cancelled' | string;
  updatedAt?: number;
  distanceKm?: number;
  customerName?: string;
  createdAt?: number;
  agentId?: string | null;
  payoutBreakdown?: {
    base_pay: number;
    distance_pay: number;
    distance_km: number;
    rate_per_km: number;
  };
  roadDistance?: boolean; // Flag indicating backend calculated road distance
};

function coerceStatus(s?: string | null): ZaagoOrder['status'] {
  if (!s) return 'new';
  const v = s.toLowerCase();
  if (['new', 'open', 'accepted', 'picked', 'picked_up', 'delivered', 'canceled', 'cancelled'].includes(v)) return v as any;
  return v;
}

/**
 * Fetch available orders from backend
 * ALL distance and payout calculations are done on backend
 * Frontend only displays the values
 */
export async function fetchAvailableOrders(agentId: string): Promise<ZaagoOrder[]> {
  if (!agentId) return [];

  console.log('📤 Fetching available orders for agent:', agentId);

  const { data, error } = await supabase.functions.invoke('get-available-orders', {
    body: { agent_id: agentId },
  });

  if (error) {
    console.error('❌ Error fetching available orders:', error);
    throw new Error(error.message || 'Failed to fetch available orders');
  }

  if (!data?.success) {
    console.error('❌ Failed to fetch available orders:', data);
    throw new Error(data?.error || 'Failed to fetch available orders');
  }

  console.log('✅ Fetched available orders:', data.orders?.length || 0);

  const orders = (data.orders || []).map((o: any) => {
    // Format drop address from address object
    const dropAddress = (() => {
      if (o.address?.addressLine1) {
        const parts = [
          o.address.addressLine1,
          o.address.addressLine2,
          o.address.city,
          o.address.pincode
        ].filter(Boolean);
        return parts.join(', ');
      }
      return o.address?.full_address || 'Delivery location';
    })();

    // Use ONLY backend-calculated values - NO local calculations
    return {
      id: o.id,
      pickup: o.pickup_address || o?.seller?.address_line || 'Pickup location',
      drop: dropAddress,
      pickupCoord: parsePoint(o.pickup_location || o?.seller?.coordinates) || null,
      // Use backend ETA, fallback to reasonable default only if missing
      etaMin: typeof o.estimated_delivery_time === 'number' ? Math.round(o.estimated_delivery_time) : 15,
      // Use backend payout - NEVER calculate locally
      payout: typeof o.agent_payout === 'number' ? Math.round(o.agent_payout) : 0,
      status: o.status || 'open',
      // Use backend distance - NEVER calculate locally
      distanceKm: typeof o.distance_km === 'number' ? Number(o.distance_km.toFixed(1)) : undefined,
      customerName: o.customer_name || undefined,
      createdAt: o.created_at ? new Date(o.created_at).getTime() : Date.now(),
      agentId: o.agent_id || null,
      // Include payout breakdown for UI display
      payoutBreakdown: o.payout_breakdown || undefined,
      // Flag indicating road distance was used (not Haversine)
      roadDistance: o.road_distance === true,
    };
  }) as ZaagoOrder[];

  // Filter out orders with no payout (backend couldn't calculate road distance)
  const validOrders = orders.filter(o => o.payout > 0);
  
  if (validOrders.length < orders.length) {
    console.warn(`⚠️ Filtered out ${orders.length - validOrders.length} orders without valid payout`);
  }

  return validOrders;
}

/**
 * Fetch open orders directly from database
 * Note: This is a fallback - prefer fetchAvailableOrders for accurate distance/payout
 */
export async function fetchOpenOrders(): Promise<ZaagoOrder[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, total, address, 
        pickup_address, pickup_location,
        delivery_address_id,
        customer_name,
        created_at,
        distance_km,
        delivery_addresses:delivery_address_id ( 
          id, coordinates, full_address, address_line 
        )
      `);

    if (error) throw error;
    
    // Map to ZaagoOrder format - use stored distance_km, don't calculate
    return ((data ?? []) as any[]).map(row => {
      const pickupCoord = parsePoint(row.pickup_location) ?? null;
      const dropAddress = 
        row.address?.full_address ?? 
        row.address?.addressLine1 ?? 
        row?.delivery_addresses?.full_address ?? 
        'Delivery address';

      // Use stored distance from database - DO NOT calculate
      const storedDistance = row.distance_km;
      
      return {
        id: row.id,
        pickup: row.pickup_address ?? 'Pickup',
        drop: dropAddress,
        pickupCoord,
        // Use stored distance for ETA estimate (2 min per km)
        etaMin: storedDistance ? Math.ceil(storedDistance * 2) : 15,
        // Return 0 payout - actual payout must come from backend
        payout: 0,
        status: coerceStatus(row.status),
        distanceKm: storedDistance ? Number(storedDistance.toFixed(1)) : undefined,
        customerName: row.customer_name ?? undefined,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      };
    });
  } catch (joinError) {
    console.warn('Query failed, falling back to simple query:', joinError);
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total, address, pickup_address, pickup_location, customer_name, created_at, distance_km');

    if (error) throw error;
    
    return ((data ?? []) as any[]).map(row => ({
      id: row.id,
      pickup: row.pickup_address ?? 'Pickup',
      drop: row.address?.full_address ?? 'Delivery address',
      pickupCoord: parsePoint(row.pickup_location) ?? null,
      etaMin: row.distance_km ? Math.ceil(row.distance_km * 2) : 15,
      payout: 0, // Must come from backend
      status: coerceStatus(row.status),
      distanceKm: row.distance_km ? Number(row.distance_km.toFixed(1)) : undefined,
      customerName: row.customer_name ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    }));
  }
}
