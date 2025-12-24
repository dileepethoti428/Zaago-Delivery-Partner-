import { supabase } from '@/integrations/supabase/client';

export interface AssignedOrder {
  id: string;
  dailyOrderId?: string;
  orderId?: string | null;
  date: string;
  quantity: number;
  status: string;
  subscriptionId: string | null;
  customerId: string;
  locationId: number | null;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | Record<string, unknown> | null;
  customerCity: string | null;
  customerPincode: string | null;
  customerLatitude: number | null;
  customerLongitude: number | null;
  deliveryAddress: string | Record<string, unknown> | null;
  deliveryTimeSlot: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  productId: string | null;
  productName: string;
  productPrice: number;
  productImage: string | null;
  isSubscription: boolean;
}

interface DailyOrderRow {
  id: string;
  date: string;
  quantity: number;
  status: string;
  subscription_id: string | null;
  customer_id: string;
  location_id: number | null;
  created_at: string | null;
  assigned_agent_id: string | null;
  assigned_by: string | null;
}

interface CustomerRow {
  id: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SubscriptionRow {
  id: string;
  delivery_address: string | null;
  delivery_time_slot: string | null;
  product_id: string | null;
  products: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  } | null;
}

async function transformOrdersWithDetails(rows: DailyOrderRow[]): Promise<AssignedOrder[]> {
  if (!rows || rows.length === 0) return [];

  // Get unique customer IDs and subscription IDs
  const customerIds = [...new Set(rows.map(r => r.customer_id))];
  const subscriptionIds = [...new Set(rows.map(r => r.subscription_id).filter(Boolean))] as string[];

  // Fetch customers
  const { data: customersData } = await supabase
    .from('customers')
    .select('id, full_name, phone, address, city, pincode, latitude, longitude')
    .in('id', customerIds);

  // Fetch subscriptions with product info
  const { data: subscriptionsData } = subscriptionIds.length > 0 
    ? await supabase
        .from('subscriptions')
        .select('id, delivery_address, delivery_time_slot, product_id, products(id, name, price, image_url)')
        .in('id', subscriptionIds)
    : { data: [] };

  const customers = (customersData || []) as CustomerRow[];
  const subscriptions = (subscriptionsData || []) as SubscriptionRow[];

  const customerMap = new Map<string, CustomerRow>(customers.map(c => [c.id, c]));
  const subscriptionMap = new Map<string, SubscriptionRow>(subscriptions.map(s => [s.id, s]));

  return rows.map(row => {
    const customer = customerMap.get(row.customer_id);
    const subscription = subscriptionMap.get(row.subscription_id || '');
    const product = subscription?.products;

    return {
      id: row.id,
      dailyOrderId: row.id,
      orderId: row.subscription_id,
      date: row.date,
      quantity: row.quantity,
      status: row.status,
      subscriptionId: row.subscription_id,
      customerId: row.customer_id,
      locationId: row.location_id,
      createdAt: row.created_at || new Date().toISOString(),
      customerName: customer?.full_name || 'Unknown Customer',
      customerPhone: customer?.phone || null,
      customerAddress: customer?.address || null,
      customerCity: customer?.city || null,
      customerPincode: customer?.pincode || null,
      customerLatitude: customer?.latitude || null,
      customerLongitude: customer?.longitude || null,
      deliveryAddress: subscription?.delivery_address || customer?.address || null,
      deliveryTimeSlot: subscription?.delivery_time_slot || null,
      deliveryLatitude: null,
      deliveryLongitude: null,
      productId: product?.id || null,
      productName: product?.name || 'Unknown Product',
      productPrice: product?.price || 0,
      productImage: product?.image_url || null,
      isSubscription: !!row.subscription_id,
    };
  });
}

// Fetch TODAY's orders using Postgres RPC (CURRENT_DATE)
export async function fetchTodayOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching TODAY orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_today');
  
  console.log('[AssignedOrders] TODAY RPC response:', { data, error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] TODAY RPC error:', error);
    throw error;
  }
  
  return transformOrdersWithDetails(data || []);
}

// Fetch TOMORROW's orders using Postgres RPC (CURRENT_DATE + 1)
export async function fetchTomorrowOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching TOMORROW orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_tomorrow');
  
  console.log('[AssignedOrders] TOMORROW RPC response:', { data, error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] TOMORROW RPC error:', error);
    throw error;
  }
  
  return transformOrdersWithDetails(data || []);
}

// Fetch UPCOMING orders using Postgres RPC (CURRENT_DATE + 1)
export async function fetchUpcomingOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching UPCOMING orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_upcoming');
  
  console.log('[AssignedOrders] UPCOMING RPC response:', { data, error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] UPCOMING RPC error:', error);
    throw error;
  }
  
  return transformOrdersWithDetails(data || []);
}

// Legacy function - kept for backward compatibility, now fetches all orders
export async function fetchAssignedOrders(): Promise<AssignedOrder[]> {
  const [today, tomorrow, upcoming] = await Promise.all([
    fetchTodayOrders(),
    fetchTomorrowOrders(),
    fetchUpcomingOrders(),
  ]);
  
  return [...today, ...tomorrow, ...upcoming];
}
