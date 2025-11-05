import { getDistanceKm } from '@/utils/geo';
import type { Order } from '@/store/app';

/**
 * Annotate orders with distance from agent location,
 * filter by radius, and sort by nearest first
 */
export function annotateAndFilterOrders(
  orders: Order[],
  agent: { lat: number; lng: number } | null,
  radiusKm = 15
): Order[] {
  if (!agent) return [];

  // Calculate distance for each order
  const withDistance = orders.map(order => ({
    ...order,
    distanceKm: Number(getDistanceKm(agent, order.pickupCoord).toFixed(2)),
  }));

  // Filter orders within radius
  const inRange = withDistance.filter(order => order.distanceKm! <= radiusKm);

  // Sort by distance (nearest first)
  inRange.sort((a, b) => (a.distanceKm! - b.distanceKm!));

  return inRange;
}
