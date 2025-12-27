/**
 * Zepto/Blinkit style pricing for regular orders
 * Simple and transparent: ₹10 base + ₹8/km
 * 
 * NOTE: This applies ONLY to regular orders.
 * Subscription order earnings are calculated separately.
 */
import { getCachedPayout, setCachedPayout } from './computationCache';

const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,        // Fixed ₹10 per order
  DISTANCE_RATE: 8,    // ₹8 per km
};

export interface PayoutBreakdown {
  base_pay: number;
  distance_pay: number;
  distance_km: number;
  rate_per_km: number;
  total: number;
}

/**
 * Calculate agent payout for regular orders
 * Simple formula: ₹10 base + ₹8/km
 */
export function calculateAgentPayout(distanceKm: number): number {
  const cached = getCachedPayout(distanceKm);
  if (cached !== null) return cached;
  
  // Round distance to 1 decimal place
  const roundedDistance = Math.round(distanceKm * 10) / 10;
  const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
  const total = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
  const payout = Math.round(total * 10) / 10;
  
  setCachedPayout(distanceKm, payout);
  return payout;
}

/**
 * Get detailed payout breakdown for display
 */
export function getPayoutBreakdown(distanceKm: number): PayoutBreakdown {
  const roundedDistance = Math.round(distanceKm * 10) / 10;
  const distancePay = roundedDistance * REGULAR_ORDER_PRICING.DISTANCE_RATE;
  const total = REGULAR_ORDER_PRICING.BASE_PAY + distancePay;
  
  return {
    base_pay: REGULAR_ORDER_PRICING.BASE_PAY,
    distance_pay: Math.round(distancePay * 10) / 10,
    distance_km: roundedDistance,
    rate_per_km: REGULAR_ORDER_PRICING.DISTANCE_RATE,
    total: Math.round(total * 10) / 10
  };
}

/**
 * Calculate ETA in minutes based on distance (2 min per km)
 */
export function calculateETA(distanceKm: number): number {
  return Math.ceil(distanceKm * 2);
}

export { REGULAR_ORDER_PRICING };
