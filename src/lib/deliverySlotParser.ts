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
  
  // Parse delivery_time_slot field - handles multiple formats
  if (order.delivery_time_slot) {
    const timeSlot = order.delivery_time_slot.toString().trim();
    
    // Handle time range format like "16:00-18:00" or "2:00-4:00"
    if (timeSlot.includes('-')) {
      const [startPart, endPart] = timeSlot.split('-').map(t => t.trim());
      
      const formatTime = (timeStr: string): string => {
        // Add seconds if missing
        if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
          return `${timeStr}:00`;
        }
        // Ensure 2-digit hours
        if (timeStr.match(/^\d:\d{2}(:\d{2})?$/)) {
          return `0${timeStr}`;
        }
        return timeStr;
      };
      
      const startTime = formatTime(startPart);
      const endTime = formatTime(endPart);
      
      // Validate the times are in correct HH:MM:SS format
      if (startTime.match(/^\d{2}:\d{2}:\d{2}$/) && endTime.match(/^\d{2}:\d{2}:\d{2}$/)) {
        return {
          id: `slot-${order.id}`,
          slot_name: timeSlot,
          start_time: startTime,
          end_time: endTime
        };
      }
    }
  }
  
  // Handle single delivery_time for creating a window
  if (order.delivery_time && 
      !order.delivery_time.includes('min') && 
      !order.delivery_time.includes('TBD') &&
      !order.delivery_time.includes('Time to be confirmed')) {
    
    const deliveryTime = order.delivery_time.toString().trim();
    
    // Try to parse time and create 2-hour window
    try {
      let time24Hour = deliveryTime;
      
      // Convert 12-hour to 24-hour if needed
      if (deliveryTime.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
        const match = deliveryTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (match) {
          let hours = parseInt(match[1]);
          const minutes = match[2];
          const period = match[3].toUpperCase();
          
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          time24Hour = `${hours.toString().padStart(2, '0')}:${minutes}:00`;
        }
      } else if (deliveryTime.match(/^\d{1,2}:\d{2}$/)) {
        time24Hour = `${deliveryTime}:00`;
      }
      
      // Create 2-hour window (1 hour before and after)
      const timeMatch = time24Hour.match(/^(\d{2}):(\d{2}):(\d{2})$/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        
        const startHour = Math.max(0, hours - 1);
        const endHour = Math.min(23, hours + 1);
        
        return {
          id: `slot-${order.id}`,
          slot_name: `${deliveryTime} window`,
          start_time: `${startHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`,
          end_time: `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
        };
      }
    } catch (error) {
      console.warn('Error parsing delivery_time for slots:', deliveryTime, error);
    }
  }
  
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