import { getDistanceKm } from '@/utils/geo';
import type { ZaagoOrder } from '@/services/orders';
import type { GeoPoint } from '@/utils/coords';

/**
 * Annotate orders with distance from agent location,
 * filter by radius, and sort by nearest first
 */
export function annotateAndFilterOrders(
  orders: ZaagoOrder[],
  agent: GeoPoint | null,
  radiusKm = 10
): (ZaagoOrder & { distanceKm?: number })[] {
  if (!agent) return [];

  // Calculate distance for each order (only for orders with coordinates)
  const withDistance = orders
    .filter(order => !!order.pickupCoord)
    .map(order => ({
      ...order,
      distanceKm: Number(getDistanceKm(agent, order.pickupCoord as GeoPoint).toFixed(2)),
    }));

  // Filter orders within radius
  const inRange = withDistance.filter(order => (order.distanceKm ?? 9999) <= radiusKm);

  // Sort by distance (nearest first)
  inRange.sort((a, b) => (a.distanceKm! - b.distanceKm!));

  return inRange;
}
