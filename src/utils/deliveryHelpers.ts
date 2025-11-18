export function formatDeliveryAddress(delivery_address: any): string {
  if (typeof delivery_address === 'string') {
    return delivery_address;
  }
  if (delivery_address?.address) {
    return delivery_address.address;
  }
  const addr = delivery_address;
  if (addr?.addressLine1) {
    return [
      addr.addressLine1,
      addr.addressLine2,
      addr.city,
      addr.state,
      addr.pincode
    ].filter(Boolean).join(', ');
  }
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
