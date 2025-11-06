import { supabase } from '@/integrations/supabase/client';

export interface OrderDetails {
  id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  total_amount: number;
  delivery_charge: number;
  items: any[];
  special_instructions?: string;
  delivery_otp?: string;
  otp_expiry?: string;
  subscription_id?: string;
  created_at: string;
  accepted_at?: string;
  delivered_at?: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    coordinates: any;
  };
  seller: {
    name: string;
    phone: string;
    address: string;
    coordinates: any;
  };
}

export async function getOrderDetails(orderId: string): Promise<OrderDetails> {
  const { data, error } = await supabase.functions.invoke('get-order-details', {
    body: { order_id: orderId },
  });

  if (error) {
    console.error('Error fetching order details:', error);
    throw new Error(error.message || 'Failed to fetch order details');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to fetch order details');
  }

  return data.order;
}
