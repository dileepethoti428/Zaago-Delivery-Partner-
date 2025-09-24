// Debug utility to catch address objects before they reach JSX
export const debugAddress = (address: any, context: string = 'unknown'): string => {
  console.log(`🔍 DEBUG ADDRESS [${context}]:`, address, 'Type:', typeof address);
  
  if (typeof address === 'string') {
    return address;
  }
  
  if (typeof address === 'object' && address !== null) {
    console.error(`❌ FOUND OBJECT ADDRESS [${context}]:`, address);
    
    // Force conversion to string to prevent React child error
    if (address.full_address) return String(address.full_address);
    if (address.addressLine1) return `${address.addressLine1}, ${address.city || ''}`;
    if (address.address) {
      const parts = [address.address, address.city, address.state, address.pincode].filter(Boolean);
      return parts.join(', ');
    }
    
    // Fallback: stringify the object keys to see what we have
    const keys = Object.keys(address);
    console.error(`❌ UNKNOWN ADDRESS OBJECT STRUCTURE [${context}], Keys:`, keys);
    return `[Address object: ${keys.join(', ')}]`;
  }
  
  return String(address || 'Address not available');
};