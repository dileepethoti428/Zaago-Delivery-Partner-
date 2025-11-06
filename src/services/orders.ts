import { supabase } from '@/integrations/supabase/client';
import { parsePoint, GeoPoint } from '@/utils/coords';
import { getDistanceKm } from '@/utils/geo';
import { calculateAgentPayout, calculateETA } from '@/utils/pricing';

export type DbOrderRow = {
  id: string;
  status?: string | null;
  total?: number | null;
  address?: any | null; // jsonb - delivery address
  pickup_address?: string | null;
  pickup_location?: any | null;
  delivery_address_id?: string | null;
  customer_name?: string | null;
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
};

function coerceStatus(s?: string | null): ZaagoOrder['status'] {
  if (!s) return 'new';
  const v = s.toLowerCase();
  if (['new', 'open', 'accepted', 'picked', 'picked_up', 'delivered', 'canceled', 'cancelled'].includes(v)) return v as any;
  return v;
}

function toZaagoOrder(row: DbOrderRow): ZaagoOrder {
  // Choose pickup coordinates from first available source
  const pickupCoord =
    parsePoint(row.pickup_location) ??
    parsePoint(row?.delivery_addresses?.coordinates) ??
    null;

  // Extract drop address from address jsonb or delivery_addresses
  const dropAddress = 
    row.address?.full_address ?? 
    row.address?.addressLine1 ?? 
    row?.delivery_addresses?.full_address ?? 
    row?.delivery_addresses?.address_line ?? 
    'Delivery address';

  // Extract drop coordinates from address jsonb
  const dropCoord = parsePoint(row.address?.coordinates);

  // Calculate distance if both coords available
  let distanceKm = 0;
  if (pickupCoord && dropCoord) {
    distanceKm = getDistanceKm(pickupCoord, dropCoord);
  }

  // Calculate payout and ETA based on distance
  const payout = distanceKm > 0 ? calculateAgentPayout(distanceKm) : 30;
  const etaMin = distanceKm > 0 ? calculateETA(distanceKm) : 12;

  return {
    id: row.id,
    pickup: row.pickup_address ?? row?.delivery_addresses?.address_line ?? 'Pickup',
    drop: dropAddress,
    pickupCoord,
    etaMin,
    payout,
    status: coerceStatus(row.status),
    distanceKm: distanceKm > 0 ? distanceKm : undefined,
    customerName: row.customer_name ?? undefined,
  };
}

export async function fetchOpenOrders(): Promise<ZaagoOrder[]> {
  // Try to select with delivery_addresses join
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, total, address, 
        pickup_address, pickup_location,
        delivery_address_id,
        customer_name,
        delivery_addresses:delivery_address_id ( 
          id, coordinates, full_address, address_line 
        )
      `);

    if (error) throw error;
    return ((data ?? []) as unknown as DbOrderRow[]).map(toZaagoOrder);
  } catch (joinError) {
    // Fall back to simpler query without join
    console.warn('Join query failed, falling back to simple query:', joinError);
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total, address, pickup_address, pickup_location, customer_name');

    if (error) throw error;
    return ((data ?? []) as unknown as DbOrderRow[]).map(toZaagoOrder);
  }
}
