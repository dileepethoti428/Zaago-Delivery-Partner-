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
  console.log('[AssignedOrders] Fetching orders...');
  
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('[AssignedOrders] Not authenticated');
    throw new Error('Not authenticated');
  }

  console.log('[AssignedOrders] Session user.id:', session.user.id);

  const { data, error } = await supabase.functions.invoke('get-agent-assigned-orders', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error('[AssignedOrders] Error fetching assigned orders:', error);
    throw error;
  }

  console.log('[AssignedOrders] Response data:', data);
  console.log('[AssignedOrders] Orders count:', data?.orders?.length || 0);
  console.log('[AssignedOrders] Orders:', JSON.stringify(data?.orders, null, 2));

  const orders = data?.orders || [];
  
  // NO FILTERING - return ALL orders from the edge function
  return orders;
}
