/**
 * Centralized pricing constants for regular (on-demand) orders
 * Zepto/Blinkit style: Simple and transparent
 * 
 * Formula: Total Payout = ₹10 (base) + distance_km × ₹8
 * 
 * NOTE: This applies ONLY to regular orders.
 * Subscription order earnings are calculated separately.
 */

export const REGULAR_ORDER_PRICING = {
  BASE_PAY: 10,        // Fixed ₹10 per order
  DISTANCE_RATE: 8,    // ₹8 per km
  
  /**
   * Calculate payout for a regular order
   * @param distanceKm Distance from pickup to drop in kilometers
   * @returns Breakdown with base pay, distance pay, total, and distance
   */
  calculate(distanceKm: number): {
    base_pay: number;
    distance_pay: number;
    distance_km: number;
    rate_per_km: number;
    total: number;
  } {
    // Round distance to 1 decimal place
    const roundedDistance = Math.round(distanceKm * 10) / 10;
    const distancePay = roundedDistance * this.DISTANCE_RATE;
    const total = this.BASE_PAY + distancePay;
    
    return {
      base_pay: this.BASE_PAY,
      distance_pay: Math.round(distancePay * 10) / 10,
      distance_km: roundedDistance,
      rate_per_km: this.DISTANCE_RATE,
      total: Math.round(total * 10) / 10
    };
  }
};

export default REGULAR_ORDER_PRICING;
