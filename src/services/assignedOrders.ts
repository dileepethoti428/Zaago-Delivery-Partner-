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
  productUnit: string | null;
  productPrice: number;
  productImage: string | null;
  isSubscription: boolean;
  isOnVacation: boolean;
  sellerLatitude: number | null;
  sellerLongitude: number | null;
  sellerName: string | null;
  distanceFromShop?: number | null;
  deliveryType: 'immediate' | 'scheduled' | 'subscription' | 'book_now_pay_later';
}

// Interface for the enriched RPC response
interface EnrichedOrderRow {
  order_id: string;
  order_date: string;
  quantity: number;
  order_status: string;
  subscription_id: string | null;
  customer_id: string;
  location_id: number | null;
  created_at: string | null;
  assigned_agent_id: string | null;
  assigned_by: string | null;
  delivery_address: string | Record<string, unknown> | null;
  delivery_time_slot: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_city: string | null;
  customer_pincode: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  product_id: string | null;
  product_name: string | null;
  product_price: number | null;
  product_image_url: string | null;
  is_on_vacation: boolean | null;
  seller_latitude: number | null;
  seller_longitude: number | null;
  seller_name: string | null;
}

// Transform enriched RPC response directly to AssignedOrder
function transformEnrichedOrders(rows: EnrichedOrderRow[]): AssignedOrder[] {
  if (!rows || rows.length === 0) return [];

  return rows.map(row => ({
    id: row.order_id,
    dailyOrderId: row.order_id,
    orderId: row.subscription_id,
    date: row.order_date,
    quantity: row.quantity,
    status: row.order_status,
    subscriptionId: row.subscription_id,
    customerId: row.customer_id,
    locationId: row.location_id,
    createdAt: row.created_at || new Date().toISOString(),
    customerName: row.customer_name || 'Unknown Customer',
    customerPhone: row.customer_phone || null,
    customerAddress: row.customer_address || null,
    customerCity: row.customer_city || null,
    customerPincode: row.customer_pincode || null,
    customerLatitude: row.customer_latitude || null,
    customerLongitude: row.customer_longitude || null,
    deliveryAddress: row.delivery_address || row.customer_address || null,
    deliveryTimeSlot: row.delivery_time_slot || null,
    deliveryLatitude: row.delivery_latitude || null,
    deliveryLongitude: row.delivery_longitude || null,
    productId: row.product_id || null,
    productName: row.product_name || 'Unknown Product',
    productUnit: null,
    productPrice: row.product_price || 0,
    productImage: row.product_image_url || null,
    isSubscription: !!row.subscription_id,
    isOnVacation: row.is_on_vacation === true,
    sellerLatitude: row.seller_latitude ?? null,
    sellerLongitude: row.seller_longitude ?? null,
    sellerName: row.seller_name || null,
    deliveryType: row.subscription_id
      ? 'subscription'
      : 'immediate',
  }));
}

// Batch-fetch product units and stamp onto orders
async function enrichWithProductUnits(orders: AssignedOrder[]): Promise<AssignedOrder[]> {
  const missing = orders.filter(o => !o.productUnit && o.productId).map(o => o.productId!) as string[];
  const ids = Array.from(new Set(missing));
  if (ids.length === 0) return orders;
  try {
    const { data } = await supabase.from('products').select('id, unit').in('id', ids);
    if (!data || data.length === 0) return orders;
    const map = new Map<string, string>();
    data.forEach((p: any) => { if (p.unit) map.set(p.id, p.unit); });
    return orders.map(o => o.productUnit || !o.productId ? o : { ...o, productUnit: map.get(o.productId) || null });
  } catch (e) {
    console.warn('[AssignedOrders] unit enrichment failed', e);
    return orders;
  }
}

// Fetch TODAY's orders using Postgres RPC with enriched data
export async function fetchTodayOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching TODAY orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_today');
  
  console.log('[AssignedOrders] TODAY RPC response:', { error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] TODAY RPC error:', error);
    throw error;
  }
  
  return transformEnrichedOrders((data || []) as unknown as EnrichedOrderRow[]);
}

// Fetch TOMORROW's orders using Postgres RPC with enriched data
export async function fetchTomorrowOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching TOMORROW orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_tomorrow');
  
  console.log('[AssignedOrders] TOMORROW RPC response:', { error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] TOMORROW RPC error:', error);
    throw error;
  }
  
  return transformEnrichedOrders((data || []) as unknown as EnrichedOrderRow[]);
}

// Fetch UPCOMING orders using Postgres RPC with enriched data
export async function fetchUpcomingOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching UPCOMING orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_upcoming');
  
  console.log('[AssignedOrders] UPCOMING RPC response:', { error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] UPCOMING RPC error:', error);
    throw error;
  }
  
  return transformEnrichedOrders((data || []) as unknown as EnrichedOrderRow[]);
}

// Interface for the delivered orders RPC response (simpler than EnrichedOrderRow)
interface DeliveredOrderRow {
  id: string;
  date: string;
  quantity: number;
  status: string;
  subscription_id: string | null;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_latitude: number | null;
  customer_longitude: number | null;
  product_id: string | null;
  product_name: string | null;
  product_unit: string | null;
  product_image: string | null;
  seller_id: string | null;
}

// Transform delivered orders RPC response to AssignedOrder
function transformDeliveredOrders(rows: DeliveredOrderRow[]): AssignedOrder[] {
  if (!rows || rows.length === 0) return [];

  return rows.map(row => ({
    id: row.id,
    dailyOrderId: row.id,
    orderId: row.subscription_id,
    date: row.date,
    quantity: row.quantity,
    status: row.status,
    subscriptionId: row.subscription_id,
    customerId: row.customer_id,
    locationId: null,
    createdAt: new Date().toISOString(),
    customerName: row.customer_name || 'Unknown Customer',
    customerPhone: row.customer_phone || null,
    customerAddress: row.customer_address || null,
    customerCity: null,
    customerPincode: null,
    customerLatitude: row.customer_latitude || null,
    customerLongitude: row.customer_longitude || null,
    deliveryAddress: row.customer_address || null,
    deliveryTimeSlot: null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    productId: row.product_id || null,
    productName: row.product_name || 'Unknown Product',
    productUnit: row.product_unit || null,
    productPrice: 0,
    productImage: row.product_image || null,
    isSubscription: !!row.subscription_id,
    isOnVacation: false,
    sellerLatitude: null,
    sellerLongitude: null,
    sellerName: null,
    deliveryType: row.subscription_id ? 'subscription' : 'immediate',
  }));
}

// Fetch DELIVERED orders for today using Postgres RPC
export async function fetchDeliveredOrders(): Promise<AssignedOrder[]> {
  console.log('[AssignedOrders] Fetching DELIVERED orders via RPC...');
  
  const { data, error } = await supabase.rpc('get_agent_orders_delivered_today');
  
  console.log('[AssignedOrders] DELIVERED RPC response:', { error, count: data?.length || 0 });
  
  if (error) {
    console.error('[AssignedOrders] DELIVERED RPC error:', error);
    throw error;
  }
  
  return transformDeliveredOrders((data || []) as DeliveredOrderRow[]);
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
