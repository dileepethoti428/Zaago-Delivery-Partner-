import { normalizeAddress } from './utils';
import { formatLocationToAddressSync } from './addressFormatter';

// Enhanced debug utility to catch address objects and format them to human-readable addresses
export const debugAddress = (address: any, context: string = 'unknown'): string => {
  console.log(`🔍 DEBUG ADDRESS [${context}]:`, address, 'Type:', typeof address);
  
  // Use the address formatter first to convert coordinates to addresses
  try {
    // First try the address formatter (handles coordinates → address)
    const formatted = formatLocationToAddressSync(address);
    
    // If formatter returns coordinates, fallback to normalizeAddress
    if (formatted && !formatted.match(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)) {
      console.log(`✅ FORMATTED ADDRESS [${context}]:`, formatted);
      return formatted;
    }
    
    // Fallback to normalizeAddress for non-coordinate addresses
    const normalized = normalizeAddress(address);
    
    // Double-check the result is a string
    if (typeof normalized !== 'string') {
      console.error(`❌ CRITICAL: normalizeAddress returned non-string [${context}]:`, normalized);
      return 'Address normalization failed';
    }
    
    // Log if we had to convert an object
    if (typeof address === 'object' && address !== null) {
      console.warn(`⚠️ CONVERTED OBJECT ADDRESS [${context}]:`, {
        original: address,
        normalized: normalized,
        keys: Object.keys(address)
      });
    }
    
    return normalized;
    
  } catch (error) {
    console.error(`❌ ERROR in debugAddress [${context}]:`, error, address);
    return 'Address debug error';
  }
};