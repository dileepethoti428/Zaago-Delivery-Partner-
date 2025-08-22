-- Insert additional customers and orders for the mock data mentioned
-- First, let's create some orders that match our previous mock data

INSERT INTO orders (
  id,
  customer_name,
  customer_phone,
  address,
  items,
  total,
  status,
  delivery_date,
  created_at,
  payment_status,
  user_id
) VALUES 
(
  gen_random_uuid(),
  'Rohit Sharma', 
  '9876543210',
  jsonb_build_object(
    'fullName', 'Rohit Sharma',
    'phone', '9876543210',
    'addressLine1', 'Sector 21',
    'addressLine2', 'Near Sports Complex',
    'city', 'Phagwara',
    'state', 'Punjab',
    'pincode', '144401',
    'coordinates', jsonb_build_object('lat', 31.2338, 'lng', 75.6415)
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Pizza Margherita',
      'price', 250,
      'quantity', 2,
      'restaurant', 'Pizza Corner',
      'type', 'Food'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Garlic Bread',
      'price', 120,
      'quantity', 1,
      'restaurant', 'Pizza Corner',
      'type', 'Food'
    )
  ),
  370,
  'placed',
  CURRENT_DATE,
  NOW(),
  'Pending',
  '034f84a0-f27e-42fd-805b-504d93db489d'
),
(
  gen_random_uuid(),
  'Priya Singh',
  '9876543211', 
  jsonb_build_object(
    'fullName', 'Priya Singh',
    'phone', '9876543211',
    'addressLine1', 'Civil Lines',
    'addressLine2', 'Near Railway Station',
    'city', 'Jalandhar',
    'state', 'Punjab',
    'pincode', '144001',
    'coordinates', jsonb_build_object('lat', 31.3260, 'lng', 75.5762)
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Chicken Burger',
      'price', 180,
      'quantity', 1,
      'restaurant', 'Burger House',
      'type', 'Food'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'French Fries',
      'price', 80,
      'quantity', 1,
      'restaurant', 'Burger House',
      'type', 'Food'
    )
  ),
  260,
  'placed',
  CURRENT_DATE,
  NOW(),
  'Pending',
  '034f84a0-f27e-42fd-805b-504d93db489d'
),
(
  gen_random_uuid(),
  'Amit Kumar',
  '9876543212',
  jsonb_build_object(
    'fullName', 'Amit Kumar',
    'phone', '9876543212',
    'addressLine1', 'Model Town',
    'addressLine2', 'Near City Mall',
    'city', 'Phagwara',
    'state', 'Punjab',
    'pincode', '144401',
    'coordinates', jsonb_build_object('lat', 31.2180, 'lng', 75.7781)
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Royal Thali',
      'price', 350,
      'quantity', 1,
      'restaurant', 'Royal Dine',
      'type', 'Food'
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Lassi',
      'price', 70,
      'quantity', 2,
      'restaurant', 'Royal Dine',
      'type', 'Beverage'
    )
  ),
  490,
  'placed',
  CURRENT_DATE,
  NOW(),
  'Pending',
  '034f84a0-f27e-42fd-805b-504d93db489d'
),
(
  gen_random_uuid(),
  'Neha Gupta',
  '9876543213',
  jsonb_build_object(
    'fullName', 'Neha Gupta',
    'phone', '9876543213',
    'addressLine1', 'Urban Estate',
    'addressLine2', 'Phase 2',
    'city', 'Jalandhar',
    'state', 'Punjab',
    'pincode', '144022',
    'coordinates', jsonb_build_object('lat', 31.3157, 'lng', 75.5851)
  ),
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'name', 'Coffee',
      'price', 95,
      'quantity', 1,
      'restaurant', 'Cafe Delight',
      'type', 'Beverage'
    )
  ),
  95,
  'placed',
  CURRENT_DATE,
  NOW(),
  'Pending',
  '034f84a0-f27e-42fd-805b-504d93db489d'
);