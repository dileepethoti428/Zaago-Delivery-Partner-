import { useState, useEffect } from 'react';
import { formatLocationToAddress, formatLocationToAddressSync } from '@/lib/addressFormatter';

interface UseFormattedAddressResult {
  address: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook to convert location (coordinates or address object) to human-readable address
 * Handles async reverse geocoding with loading states
 */
export const useFormattedAddress = (location: any): UseFormattedAddressResult => {
  const [address, setAddress] = useState<string>(formatLocationToAddressSync(location));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) {
      setAddress('Address not available');
      return;
    }

    const formatAddress = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const formatted = await formatLocationToAddress(location);
        setAddress(formatted);
      } catch (err) {
        console.error('Address formatting error:', err);
        setError(err instanceof Error ? err.message : 'Failed to format address');
        setAddress(formatLocationToAddressSync(location)); // Fallback to sync version
      } finally {
        setIsLoading(false);
      }
    };

    formatAddress();
  }, [location]);

  return { address, isLoading, error };
};

/**
 * Helper function to format address synchronously (returns cached or coordinates)
 * Use this when you can't use hooks or need immediate result
 */
export const formatAddress = formatLocationToAddressSync;

/**
 * Helper function to format address asynchronously (fetches from API if needed)
 * Use this in non-component contexts
 */
export const formatAddressAsync = formatLocationToAddress;
