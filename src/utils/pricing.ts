/**
 * Calculate agent payout based on distance
 * Base: ₹40 for ≤3km, ₹9/km beyond
 * Peak surge: 15% (12-2pm, 7-10pm, weekends)
 * Agent gets: total - ₹13 platform fee
 */
import { getCachedPayout, setCachedPayout } from './computationCache';

export function calculateAgentPayout(distanceKm: number): number {
  const cached = getCachedPayout(distanceKm);
  if (cached !== null) return cached;
  const baseFare = 40;
  const additionalDistance = Math.max(0, distanceKm - 3);
  const perKmRate = 9;
  const distanceFare = additionalDistance * perKmRate;
  const subtotal = baseFare + distanceFare;
  
  // Peak hour check
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isPeak = (hour >= 12 && hour < 14) || 
                 (hour >= 19 && hour < 22) || 
                 [0, 6].includes(day);
  const surge = isPeak ? subtotal * 0.15 : 0;
  
  const platformFee = 13;
  const agentPayout = subtotal + surge - platformFee;
  const payout = Math.round(agentPayout * 100) / 100;
  
  setCachedPayout(distanceKm, payout);
  return payout;
}

/**
 * Calculate ETA in minutes based on distance (2 min per km)
 */
export function calculateETA(distanceKm: number): number {
  return Math.ceil(distanceKm * 2);
}
