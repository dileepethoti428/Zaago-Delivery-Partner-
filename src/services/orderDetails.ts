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
  delivery_time_slot?: string;
  delivery_date?: string;
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

interface GetOrderDetailsOptions {
  type?: 'order' | 'daily';
}

export async function getOrderDetails(
  orderId: string,
  opts: GetOrderDetailsOptions = {}
): Promise<OrderDetails> {
  const { type = 'order' } = opts;

  // For daily/subscription orders
  if (type === 'daily') {
    return getDailyOrderDetails(orderId);
  }

  // For regular orders
  return getRegularOrderDetails(orderId);
}

async function getDailyOrderDetails(orderId: string): Promise<OrderDetails> {
  // Fetch daily_order with subscription info
  const { data: dailyOrder, error: dailyError } = await supabase
    .from('daily_orders')
    .select(`
      id,
      date,
      quantity,
      status,
      subscription_id,
      customer_id,
      created_at
    `)
    .eq('id', orderId)
    .single();

  if (dailyError || !dailyOrder) {
    console.error('Daily order not found:', dailyError);
    throw new Error('Order not found');
  }

  // Fetch subscription details including payment_id to determine if pre-paid
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select(`
      id,
      product_id,
      delivery_address,
      special_instructions,
      payment_id
    `)
    .eq('id', dailyOrder.subscription_id)
    .single();

  if (subError || !subscription) {
    console.error('Subscription not found:', subError);
    throw new Error('Subscription details not found');
  }

  // Subscriptions with payment_id are pre-paid (ONLINE), otherwise COD
  const isPrepaid = !!subscription.payment_id;

  // Fetch customer details
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select(`
      id,
      full_name,
      phone,
      address,
      city,
      state,
      pincode,
      latitude,
      longitude
    `)
    .eq('id', dailyOrder.customer_id)
    .single();

  if (custError || !customer) {
    console.error('Customer not found:', custError);
    throw new Error('Customer details not found');
  }

  // Fetch product with seller info (products_with_sellers view)
  const { data: product, error: prodError } = await supabase
    .from('products_with_sellers')
    .select(`
      id,
      name,
      price,
      seller_id,
      seller_name,
      seller_business
    `)
    .eq('id', subscription.product_id)
    .single();

  if (prodError || !product) {
    console.error('Product not found:', prodError);
    throw new Error('Product details not found');
  }

  // Fetch seller details for phone/address/coordinates
  // Note: products.seller_id matches sellers.user_id (not sellers.id)
  const { data: seller } = await supabase
    .from('sellers')
    .select('phone, address, latitude, longitude')
    .eq('user_id', product.seller_id)
    .maybeSingle();

  // Parse delivery_address if it's a JSON object
  let deliveryAddr = subscription.delivery_address as any;
  if (typeof deliveryAddr === 'string') {
    try {
      deliveryAddr = JSON.parse(deliveryAddr);
    } catch {
      deliveryAddr = { full_address: deliveryAddr };
    }
  }

  // Normalize coordinates - delivery_address may use latitude/longitude instead of lat/lng
  const deliveryLat = deliveryAddr?.coordinates?.lat ?? deliveryAddr?.coordinates?.latitude ?? customer.latitude;
  const deliveryLng = deliveryAddr?.coordinates?.lng ?? deliveryAddr?.coordinates?.longitude ?? customer.longitude;

  // Parse seller address if it's a JSON object
  let sellerAddrStr = '';
  if (seller?.address) {
    const sellerAddr = seller.address as any;
    if (typeof sellerAddr === 'object') {
      sellerAddrStr = [sellerAddr.address, sellerAddr.city, sellerAddr.state, sellerAddr.pincode]
        .filter(Boolean)
        .join(', ');
    } else {
      sellerAddrStr = String(sellerAddr);
    }
  }

  const totalAmount = (product.price || 0) * dailyOrder.quantity;

  return {
    id: dailyOrder.id,
    status: dailyOrder.status || 'pending',
    payment_method: isPrepaid ? 'ONLINE' : 'COD',
    payment_status: isPrepaid ? 'paid' : 'pending',
    total_amount: totalAmount,
    delivery_charge: 0,
    items: [
      {
        product_name: product.name,
        name: product.name,
        price: product.price,
        quantity: dailyOrder.quantity,
      },
    ],
    special_instructions: subscription.special_instructions || undefined,
    subscription_id: dailyOrder.subscription_id,
    created_at: dailyOrder.created_at,
    customer: {
      name: customer.full_name || 'Customer',
      phone: customer.phone || '',
      address: deliveryAddr?.full_address || customer.address || '',
      city: deliveryAddr?.city || customer.city || '',
      state: deliveryAddr?.state || customer.state || '',
      pincode: deliveryAddr?.pincode || customer.pincode || '',
      landmark: deliveryAddr?.landmark || undefined,
      coordinates: {
        lat: deliveryLat,
        lng: deliveryLng,
      },
    },
    seller: {
      name: product.seller_name || product.seller_business || 'Seller',
      phone: seller?.phone || '',
      address: sellerAddrStr,
      coordinates: {
        lat: seller?.latitude || null,
        lng: seller?.longitude || null,
      },
    },
  };
}

async function getRegularOrderDetails(orderId: string): Promise<OrderDetails> {
  // orders table uses 'total' not 'total_amount', 'address' is JSON
  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      payment_method,
      payment_status,
      total,
      items,
      special_instructions,
      delivery_otp,
      otp_expires_at,
      created_at,
      accepted_at,
      delivered_at,
      customer_name,
      customer_phone,
      address,
      seller_name,
      seller_phone,
      pickup_address,
      seller_latitude,
      seller_longitude,
      delivery_latitude,
      delivery_longitude,
      subscription_id,
      delivery_payout
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) {
    console.error('Order not found:', error);
    throw new Error('Order not found');
  }

  // Parse address if it's a JSON string
  let parsedAddress = order.address as any;
  if (typeof parsedAddress === 'string') {
    try {
      parsedAddress = JSON.parse(parsedAddress);
    } catch {
      parsedAddress = { full_address: parsedAddress };
    }
  }

  return {
    id: order.id,
    status: order.status || 'pending',
    payment_method: order.payment_method || 'COD',
    payment_status: order.payment_status || 'pending',
    total_amount: order.total || 0,
    delivery_charge: order.delivery_payout || 0,
    items: (order.items as any[]) || [],
    special_instructions: order.special_instructions || undefined,
    delivery_otp: order.delivery_otp || undefined,
    otp_expiry: order.otp_expires_at || undefined,
    subscription_id: order.subscription_id || undefined,
    created_at: order.created_at,
    accepted_at: order.accepted_at || undefined,
    delivered_at: order.delivered_at || undefined,
    customer: {
      name: order.customer_name || 'Customer',
      phone: order.customer_phone || '',
      address: parsedAddress?.full_address || '',
      city: parsedAddress?.city || '',
      state: parsedAddress?.state || '',
      pincode: parsedAddress?.pincode || '',
      landmark: parsedAddress?.landmark || undefined,
      coordinates: {
        lat: order.delivery_latitude || parsedAddress?.coordinates?.lat,
        lng: order.delivery_longitude || parsedAddress?.coordinates?.lng,
      },
    },
    seller: {
      name: order.seller_name || 'Seller',
      phone: order.seller_phone || '',
      address: order.pickup_address || '',
      coordinates: {
        lat: order.seller_latitude || null,
        lng: order.seller_longitude || null,
      },
    },
  };
}
