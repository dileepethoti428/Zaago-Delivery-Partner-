import { Calendar } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

interface ScheduledBadgeProps {
  timeSlot?: string;  // e.g., "10:00-12:00"
  date?: string;      // e.g., "2025-02-04"
}

/**
 * Format time from 24h to 12h format
 * "10:00" -> "10:00 AM"
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format time slot for display
 * "10:00-12:00" -> "10:00 AM - 12:00 PM"
 */
function formatTimeSlot(slot: string): string {
  const parts = slot.split('-');
  if (parts.length !== 2) return slot;
  return `${formatTime(parts[0].trim())} - ${formatTime(parts[1].trim())}`;
}

/**
 * Format date for display
 */
function formatDateLabel(dateStr: string): string | null {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return null; // Don't show date if today
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d'); // e.g., "Feb 5"
  } catch {
    return null;
  }
}

export function ScheduledBadge({ timeSlot, date }: ScheduledBadgeProps) {
  if (!timeSlot) return null;

  const formattedSlot = formatTimeSlot(timeSlot);
  const dateLabel = date ? formatDateLabel(date) : null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium">
      <Calendar className="h-3.5 w-3.5" />
      <span>
        {dateLabel ? `${dateLabel}, ${formattedSlot}` : formattedSlot}
      </span>
    </div>
  );
}
