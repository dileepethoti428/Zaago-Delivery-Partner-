// Utility for parsing delivery time slots from various formats

export interface DeliverySlot {
  id: string;
  slot_name: string;
  start_time: string;
  end_time: string;
}

export const parseDeliverySlots = (order: any): DeliverySlot | undefined => {
  // If delivery_slots already exists and is valid, use it
  if (order.delivery_slots?.start_time && order.delivery_slots?.end_time) {
    return order.delivery_slots;
  }
  
  // Parse delivery_time_slot or delivery_time from the order
  if (order.delivery_time_slot) {
    const timeSlot = order.delivery_time_slot?.toString().trim();
    if (timeSlot && timeSlot.includes('-')) {
      // Parse time range like "14:00-16:00" or "02:00-04:00"
      const [startTime, endTime] = timeSlot.split('-');
      if (startTime && endTime) {
        return {
          id: `slot-${order.id}`,
          slot_name: `${timeSlot} delivery window`,
          start_time: startTime.includes(':') ? startTime : `${startTime}:00`,
          end_time: endTime.includes(':') ? endTime : `${endTime}:00`
        };
      }
    }
  }
  
  // For delivery_time, only create slots for actual time ranges or subscription orders
  if (order.delivery_time && order.delivery_time !== '12:00:00' && order.delivery_time !== 'Immediate') {
    const timeStr = order.delivery_time?.toString().trim();
    if (timeStr && timeStr.includes('-')) {
      // Parse time range like "18:00-20:00"  
      const [startTime, endTime] = timeStr.split('-');
      if (startTime && endTime) {
        return {
          id: `slot-${order.id}`,
          slot_name: `${timeStr} delivery window`,
          start_time: startTime.includes(':') ? startTime : `${startTime}:00`,
          end_time: endTime.includes(':') ? endTime : `${endTime}:00`
        };
      }
    }
  }
  
  // Don't create synthetic slots for generic "12:00:00" delivery times
  // Let the frontend handle display of single delivery times
  return undefined;
};

// Format time slot for display
export const formatTimeSlot = (timeStr: string): string | null => {
  try {
    // Enhanced validation - skip invalid values
    if (!timeStr || 
        timeStr.toLowerCase().includes('inval') || 
        timeStr.trim() === '' ||
        timeStr === 'null' ||
        timeStr === 'undefined') {
      return null;
    }
    
    let normalizedTime = timeStr.trim();
    
    // Ensure proper time format (HH:MM:SS)
    if (normalizedTime.match(/^\d{1,2}:\d{2}$/)) {
      normalizedTime += ':00';
    }
    
    // Ensure 2-digit hours
    if (normalizedTime.match(/^\d:\d{2}:\d{2}$/)) {
      normalizedTime = `0${normalizedTime}`;
    }
    
    // Validate format before parsing
    if (!normalizedTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
      return null;
    }
    
    // Create date object with proper ISO format
    const time = new Date(`1970-01-01T${normalizedTime}`);
    
    // Check if date is valid
    if (isNaN(time.getTime())) {
      return null;
    }
    
    return time.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  } catch (error) {
    console.warn('Error formatting slot time:', timeStr, error);
    return null;
  }
};