// Strip Google Plus Codes like "2G36+F7P" or "7J4C+2X Village" from address text
const PLUS_CODE_RE = /\b[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}\b/gi;

export function stripPlusCode(text: string): string {
  if (!text) return text;
  return text
    .replace(PLUS_CODE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,+/g, ',')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .trim();
}

// Remove repeated comma-separated fragments (case-insensitive), preserving first occurrence
export function dedupeAddressParts(text: string): string {
  if (!text) return text;
  const seen = new Set<string>();
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.join(', ');
}

export function cleanAddress(text: string): string {
  return dedupeAddressParts(stripPlusCode(text || ''));
}

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
    // Format 1: Subscription orders with full_address at top level
    if (delivery_address.full_address && typeof delivery_address.full_address === 'string') {
      return String(delivery_address.full_address).trim();
    }
    
    // Format 2: Nested address object (subscription orders saved to history)
    if (delivery_address.address && typeof delivery_address.address === 'object') {
      if (delivery_address.address.full_address) {
        return String(delivery_address.address.full_address).trim();
      }
      // Try city/state/pincode from nested address
      if (delivery_address.address.city || delivery_address.address.state) {
        return [
          delivery_address.address.landmark,
          delivery_address.address.city,
          delivery_address.address.state,
          delivery_address.address.pincode
        ].filter(Boolean).map(String).join(', ') || 'Delivery address';
      }
    }
    
    // Format 3: Simple address property (string)
    if (delivery_address.address && typeof delivery_address.address === 'string') {
      return String(delivery_address.address).trim();
    }
    
    // Format 4: Order format with addressLine1
    if (delivery_address.addressLine1) {
      return [
        delivery_address.addressLine1,
        delivery_address.addressLine2,
        delivery_address.city,
        delivery_address.state,
        delivery_address.pincode
      ].filter(Boolean).map(String).join(', ');
    }
    
    // Format 5: City/state/pincode at top level
    if (delivery_address.city || delivery_address.state || delivery_address.pincode) {
      return [
        delivery_address.landmark,
        delivery_address.city,
        delivery_address.state,
        delivery_address.pincode
      ].filter(Boolean).map(String).join(', ') || 'Delivery address';
    }
  }
  
  // Final fallback
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
