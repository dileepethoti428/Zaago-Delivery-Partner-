import { supabase } from '@/integrations/supabase/client';

export interface AssignedOrder {
  id: string;
  date: string;
  quantity: number;
  status: string;
  subscriptionId: string | null;
  customerId: string;
  locationId: number | null;
  createdAt: string;
  // Customer details
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerPincode: string | null;
  customerLatitude: number | null;
  customerLongitude: number | null;
  // Delivery details
  deliveryAddress: string | null;
  deliveryTimeSlot: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  // Product details
  productId: string | null;
  productName: string;
  productPrice: number;
  productImage: string | null;
  // Flags
  isSubscription: boolean;
}

export async function fetchAssignedOrders(): Promise<AssignedOrder[]> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('get-agent-assigned-orders', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('Error fetching assigned orders:', error);
    throw error;
  }

  return data?.orders || [];
}
