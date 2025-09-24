import { normalizeAddress } from './utils';

// Enhanced debug utility to catch address objects before they reach JSX
export const debugAddress = (address: any, context: string = 'unknown'): string => {
  console.log(`🔍 DEBUG ADDRESS [${context}]:`, address, 'Type:', typeof address);
  
  // Use the robust normalizeAddress function
  try {
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