import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Robust address normalization to prevent React child errors
export function normalizeAddress(addressObj: any): string {
  if (typeof addressObj === 'string') return addressObj;
  if (addressObj?.full_address) return addressObj.full_address;
  if (addressObj?.addressLine1) return `${addressObj.addressLine1}, ${addressObj.city || ''}`;
  if (addressObj?.address) {
    // Handle {city, state, address, pincode} structure
    const parts = [
      addressObj.address,
      addressObj.city,
      addressObj.state,
      addressObj.pincode
    ].filter(Boolean);
    return parts.join(', ');
  }
  if (typeof addressObj === 'object' && addressObj) {
    // Fallback for any other object structure
    const addressStr = Object.values(addressObj).filter(Boolean).join(', ');
    return addressStr || 'Address not available';
  }
  return 'Address not available';
}
