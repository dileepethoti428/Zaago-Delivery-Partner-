export function formatDeliveryAddress(delivery_address: any): string {
  // Handle strings directly
  if (typeof delivery_address === 'string') {
    return delivery_address.trim() || 'Delivery address';
  }
  
  // Handle null/undefined
  if (!delivery_address) {
    return 'Delivery address';
  }
  
  // Handle objects
  if (typeof delivery_address === 'object') {
    // Format 1: Subscription orders with full_address
    if (delivery_address.full_address) {
      return String(delivery_address.full_address).trim();
    }
    
    // Format 2: Simple address property
    if (delivery_address.address) {
      return String(delivery_address.address).trim();
    }
    
    // Format 3: Order format with addressLine1
    if (delivery_address.addressLine1) {
      return [
        delivery_address.addressLine1,
        delivery_address.addressLine2,
        delivery_address.city,
        delivery_address.state,
        delivery_address.pincode
      ].filter(Boolean).map(String).join(', ');
    }
    
    // Format 4: City/state/pincode combination (subscription fallback)
    if (delivery_address.city || delivery_address.state || delivery_address.pincode) {
      return [
        delivery_address.landmark,
        delivery_address.city,
        delivery_address.state,
        delivery_address.pincode
      ].filter(Boolean).map(String).join(', ') || 'Delivery address';
    }
  }
  
  // Final fallback - NEVER return an object
  return 'Delivery address';
}

export function formatPhoneNumber(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.startsWith('+91')) return phone;
  return `+91 ${phone}`;
}

export function parseDeliveryItems(items: any): any[] {
  if (Array.isArray(items)) return items;
  return [];
}
