import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Comprehensive address normalization to prevent React child errors
export function normalizeAddress(addressObj: any): string {
  // Always log the input for debugging
  console.log('🔧 normalizeAddress input:', addressObj, 'Type:', typeof addressObj);
  
  // Return strings as-is
  if (typeof addressObj === 'string') {
    return addressObj.trim() || 'Address not available';
  }
  
  // Handle null or undefined
  if (!addressObj) {
    return 'Address not available';
  }
  
  // Handle objects
  if (typeof addressObj === 'object') {
    try {
      // Format 1: User delivery address format {full_address, city, state, pincode, ...}
      if (addressObj.full_address) {
        return String(addressObj.full_address).trim();
      }
      
      // Format 2: Order address format {addressLine1, addressLine2, city, state, ...}
      if (addressObj.addressLine1) {
        const parts = [
          addressObj.addressLine1,
          addressObj.addressLine2,
          addressObj.city,
          addressObj.state,
          addressObj.pincode
        ].filter(Boolean).map(String);
        return parts.join(', ').trim();
      }
      
      // Format 3: Database error format {city, state, address, pincode}
      if (addressObj.address) {
        const parts = [
          addressObj.address,
          addressObj.city,
          addressObj.state,
          addressObj.pincode
        ].filter(Boolean).map(String);
        return parts.join(', ').trim();
      }
      
      // Format 4: Simple city/state format
      if (addressObj.city || addressObj.state) {
        const parts = [
          addressObj.city,
          addressObj.state,
          addressObj.pincode
        ].filter(Boolean).map(String);
        return parts.join(', ').trim() || 'Address not available';
      }
      
      // Format 5: Any object with address-like properties
      const addressKeys = ['street', 'road', 'area', 'locality', 'neighborhood', 'district'];
      const locationKeys = ['city', 'town', 'village', 'state', 'province', 'pincode', 'zipcode', 'postal_code'];
      
      const addressParts = [];
      const locationParts = [];
      
      // Extract address components
      addressKeys.forEach(key => {
        if (addressObj[key] && typeof addressObj[key] === 'string') {
          addressParts.push(addressObj[key]);
        }
      });
      
      // Extract location components
      locationKeys.forEach(key => {
        if (addressObj[key] && typeof addressObj[key] === 'string') {
          locationParts.push(addressObj[key]);
        }
      });
      
      const allParts = [...addressParts, ...locationParts].filter(Boolean);
      
      if (allParts.length > 0) {
        return allParts.join(', ').trim();
      }
      
      // Last resort: try to stringify safely
      const allValues = Object.values(addressObj)
        .filter(val => val && typeof val === 'string' && val.trim())
        .map(val => String(val).trim())
        .filter(Boolean);
      
      if (allValues.length > 0) {
        return allValues.slice(0, 4).join(', '); // Max 4 components to avoid too long strings
      }
      
      console.warn('⚠️ Cannot normalize address object:', addressObj);
      return 'Address format not recognized';
      
    } catch (error) {
      console.error('❌ Error normalizing address:', error, addressObj);
      return 'Address processing error';
    }
  }
  
  // Final fallback
  return String(addressObj || 'Address not available').trim();
}
