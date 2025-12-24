/**
 * Opens Google Maps with the given address
 */
export function openGoogleMapsAddress(address: string): void {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  window.open(url, '_blank');
}

/**
 * Opens Google Maps with the given coordinates
 */
export function openGoogleMapsCoordinates(lat: number, lng: number): void {
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  window.open(url, '_blank');
}
