import { supabase } from '@/integrations/supabase/client';
import { parsePoint, GeoPoint } from '@/utils/coords';

export type DbOrderRow = {
  id: string;
  status?: string | null;
  payout?: number | null;
  eta_min?: number | null;
  pickup_address?: string | null;
  drop_address?: string | null;
  pickup_location?: any | null;
  delivery_address_id?: string | null;
  delivery_addresses?: { id: string; coordinates?: any | null; address_line?: string | null } | null;
};

export type ZaagoOrder = {
  id: string;
  pickup: string;
  drop: string;
  pickupCoord: GeoPoint | null;
  etaMin: number;
  payout: number;
  status: 'new' | 'open' | 'accepted' | 'picked' | 'delivered' | 'canceled' | string;
  updatedAt?: number;
};

function coerceStatus(s?: string | null): ZaagoOrder['status'] {
  if (!s) return 'new';
  const v = s.toLowerCase();
  if (['new', 'open', 'accepted', 'picked', 'delivered', 'canceled'].includes(v)) return v as any;
  return v;
}

function toZaagoOrder(row: DbOrderRow): ZaagoOrder {
  // Choose pickup coordinates from first available source
  const pickupCoord =
    parsePoint(row.pickup_location) ??
    parsePoint(row?.delivery_addresses?.coordinates) ??
    null;

  return {
    id: row.id,
    pickup: row.pickup_address ?? row?.delivery_addresses?.address_line ?? 'Pickup',
    drop: row.drop_address ?? 'Drop',
    pickupCoord,
    etaMin: typeof row.eta_min === 'number' ? row.eta_min : 12,
    payout: typeof row.payout === 'number' ? row.payout : 30,
    status: coerceStatus(row.status),
  };
}

export async function fetchOpenOrders(): Promise<ZaagoOrder[]> {
  // Try to select with delivery_addresses join
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, status, payout, eta_min, pickup_address, drop_address, pickup_location,
        delivery_address_id,
        delivery_addresses:delivery_address_id ( id, coordinates, address_line )
      `);

    if (error) throw error;
    return ((data ?? []) as unknown as DbOrderRow[]).map(toZaagoOrder);
  } catch (joinError) {
    // Fall back to simpler query without join
    console.warn('Join query failed, falling back to simple query:', joinError);
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, payout, eta_min, pickup_address, drop_address, pickup_location');

    if (error) throw error;
    return ((data ?? []) as unknown as DbOrderRow[]).map(toZaagoOrder);
  }
}
