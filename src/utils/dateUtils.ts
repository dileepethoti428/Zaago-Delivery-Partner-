/**
 * IST-safe date utilities for the Delivery Partner App
 * All dates displayed must be in IST (Asia/Kolkata)
 * Database stores UTC, we convert on display
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Get today's date in IST timezone as YYYY-MM-DD
 */
export function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: IST_TIMEZONE
  });
}

/**
 * Get tomorrow's date in IST timezone as YYYY-MM-DD
 */
export function getTomorrowIST(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', {
    timeZone: IST_TIMEZONE
  });
}

/**
 * Get any date in IST timezone as YYYY-MM-DD
 */
export function getDateIST(date: Date): string {
  return date.toLocaleDateString('en-CA', {
    timeZone: IST_TIMEZONE
  });
}

/**
 * Format a UTC timestamp to IST date and time
 * Example: "2025-03-27T18:30:00Z" -> "28 Mar 2025, 12:00 AM"
 */
export function formatDateTimeIST(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format a UTC timestamp to IST time only
 * Example: "2025-03-27T18:30:00Z" -> "12:00 AM"
 */
export function formatTimeIST(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format a UTC timestamp to IST date only
 * Example: "2025-03-27T18:30:00Z" -> "28 Mar 2025"
 */
export function formatDateIST(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format date as short format for order cards
 * Example: "2025-03-27" -> "Thu, 27 Mar"
 */
export function formatShortDateIST(dateString: string): string {
  // Handle date-only strings by appending midnight
  const date = dateString.includes('T') 
    ? new Date(dateString)
    : new Date(dateString + 'T00:00:00');
  
  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Get relative date label (Today, Yesterday, X days ago)
 */
export function formatRelativeDateIST(dateString: string): string {
  const todayIST = getTodayIST();
  const yesterdayIST = getYesterdayIST();
  
  // Extract just the date part for comparison
  const dateIST = dateString.includes('T')
    ? new Date(dateString).toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE })
    : dateString;
  
  if (dateIST === todayIST) return 'Today';
  if (dateIST === yesterdayIST) return 'Yesterday';
  
  // Calculate days difference
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return formatDateIST(dateString);
}

/**
 * Get yesterday's date in IST timezone as YYYY-MM-DD
 */
export function getYesterdayIST(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-CA', {
    timeZone: IST_TIMEZONE
  });
}

/**
 * Check if a date string represents today in IST
 */
export function isDateTodayIST(dateString: string): boolean {
  const dateIST = dateString.includes('T')
    ? new Date(dateString).toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE })
    : dateString;
  return dateIST === getTodayIST();
}

/**
 * Check if a date string represents tomorrow in IST
 */
export function isDateTomorrowIST(dateString: string): boolean {
  const dateIST = dateString.includes('T')
    ? new Date(dateString).toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE })
    : dateString;
  return dateIST === getTomorrowIST();
}
