/**
 * IST-safe date utilities for the Delivery Agent App
 * All dates in the database are stored in IST (Asia/Kolkata)
 */

/**
 * Get today's date in IST timezone as YYYY-MM-DD
 */
export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Get tomorrow's date in IST timezone as YYYY-MM-DD
 */
export function getTomorrowIST(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Get any date in IST timezone as YYYY-MM-DD
 */
export function getDateIST(date: Date): string {
  return date.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata'
  });
}
