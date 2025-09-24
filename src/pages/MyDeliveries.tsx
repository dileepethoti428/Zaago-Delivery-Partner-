import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Navigation,
  Package,
  SortAsc,
  Route,
  User,
  Phone,
  MessageCircle
} from 'lucide-react';
import { normalizeAddress } from '@/lib/utils';
import { debugAddress } from '@/lib/debugAddress';

interface AssignedOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: any;
  items: any;
  total: number;
  status: string;
  special_instructions?: string;
  created_at: string;
  distance?: number;
  estimated_time?: string;
}

type SortOption = 'nearest' | 'furthest' | 'newest' | 'oldest' | 'amount_high' | 'amount_low';

const MyDeliveries = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useGeolocation();
  
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('nearest');
  const [calculating, setCalculating] = useState(false);

  // Fetch assigned orders for current agent
  const fetchAssignedOrders = async () => {
    try {
      setLoading(true);
      
      // First get agent info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: agent, error: agentError } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .single();

      if (agentError || !agent) {
        throw new Error('Agent not found');
      }

      // Get assigned orders
      const { data: assignedOrders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('status', 'assigned')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(assignedOrders || []);
      
      // Calculate distances if location is available
      if (location.latitude && location.longitude && assignedOrders?.length) {
        calculateDistances(assignedOrders);
      }

    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error",
        description: "Failed to load your deliveries",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate distances to all orders
  const calculateDistances = async (ordersList: AssignedOrder[]) => {
    if (!location.latitude || !location.longitude) return;

    setCalculating(true);
    const updatedOrders = [...ordersList];

    for (let i = 0; i < updatedOrders.length; i++) {
      const order = updatedOrders[i];
      const orderAddress = order.address;
      
      if (orderAddress?.latitude && orderAddress?.longitude) {
        try {
          const { data, error } = await supabase.functions.invoke('calculate-distance-eta', {
            body: {
              origin: {
                lat: location.latitude,
                lng: location.longitude
              },
              destination: {
                lat: orderAddress.latitude,
                lng: orderAddress.longitude
              }
            }
          });

          if (!error && data) {
            updatedOrders[i] = {
              ...order,
              distance: data.distance_km,
              estimated_time: `${data.eta_mins} mins`
            };
          }
        } catch (error) {
          console.error('Error calculating distance for order:', order.id, error);
        }
      }
    }

    setOrders(updatedOrders);
    setCalculating(false);
  };

  // Sort orders based on selected option
  const sortOrders = (ordersList: AssignedOrder[], sortOption: SortOption): AssignedOrder[] => {
    const sorted = [...ordersList];

    switch (sortOption) {
      case 'nearest':
        return sorted.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
      case 'furthest':
        return sorted.sort((a, b) => (b.distance || 0) - (a.distance || 0));
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'amount_high':
        return sorted.sort((a, b) => b.total - a.total);
      case 'amount_low':
        return sorted.sort((a, b) => a.total - b.total);
      default:
        return sorted;
    }
  };

  const sortedOrders = sortOrders(orders, sortBy);

  // Handle navigation to tracking
  const handleStartDelivery = (order: AssignedOrder) => {
    navigate(`/tracking?orderId=${order.id}`, {
      state: {
        customerName: order.customer_name,
        customerAddress: normalizeAddress(order.address),
        customerLocation: null, // Temporarily disabled to prevent address object issues
        deliveryType: 'immediate',
        orderPlacedAt: order.created_at
      }
    });
  };

  useEffect(() => {
    fetchAssignedOrders();
  }, []);

  // Recalculate distances when location changes
  useEffect(() => {
    if (location.latitude && location.longitude && orders.length > 0) {
      calculateDistances(orders);
    }
  }, [location.latitude, location.longitude]);

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'nearest': return 'Nearest First';
      case 'furthest': return 'Furthest First';
      case 'newest': return 'Newest First';
      case 'oldest': return 'Oldest First';
      case 'amount_high': return 'Highest Amount';
      case 'amount_low': return 'Lowest Amount';
      default: return 'Sort By';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark">
        <div className="bg-card/80 backdrop-blur-lg border-b border-primary/20 shadow-neon sticky top-0 z-50 p-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">My Deliveries</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your deliveries...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-lg border-b border-primary/20 shadow-neon sticky top-0 z-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">My Deliveries</h1>
              <p className="text-sm text-muted-foreground">{orders.length} assigned orders</p>
            </div>
          </div>
          
          {calculating && (
            <div className="flex items-center text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
              Calculating routes...
            </div>
          )}
        </div>
      </div>

      {/* Sort Controls */}
      <div className="p-4 bg-card/50 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <SortAsc className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">Sort by:</span>
          </div>
          
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-48 bg-background border-border">
              <SelectValue placeholder="Sort orders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nearest">🎯 Nearest First</SelectItem>
              <SelectItem value="furthest">📍 Furthest First</SelectItem>
              <SelectItem value="newest">🕐 Newest First</SelectItem>
              <SelectItem value="oldest">🕑 Oldest First</SelectItem>
              <SelectItem value="amount_high">💰 Highest Amount</SelectItem>
              <SelectItem value="amount_low">💵 Lowest Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sortBy === 'nearest' && (
          <p className="text-xs text-muted-foreground mt-2">
            📍 Optimized for efficient route planning - deliver nearby orders together
          </p>
        )}
      </div>

      {/* Orders List */}
      <div className="p-4 space-y-4">
        {sortedOrders.length === 0 ? (
          <Card className="bg-card/50 border-border">
            <CardContent className="p-8 text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Assigned Orders</h3>
              <p className="text-muted-foreground mb-4">You don't have any orders assigned for delivery yet.</p>
              <Button onClick={() => navigate('/home')} className="bg-gradient-neon">
                Browse Available Orders
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedOrders.map((order, index) => (
            <Card key={order.id} className="bg-card border-border hover:shadow-neon transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <CardTitle className="text-lg text-foreground">{order.customer_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">Order #{order.id.slice(-8)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {order.distance && (
                      <Badge variant="outline" className="text-primary border-primary/30">
                        <Navigation className="w-3 h-3 mr-1" />
                        {order.distance.toFixed(1)} km
                      </Badge>
                    )}
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Assigned
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Address */}
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                        {debugAddress(order.address, `my-deliveries-${order.id}`)}
                    </p>
                    {order.estimated_time && (
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {order.estimated_time} estimated
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">
                      {Array.isArray(order.items) ? order.items.length : 'Multiple'} items
                    </span>
                  </div>
                  <span className="font-semibold text-primary">₹{order.total}</span>
                </div>

                {/* Special Instructions */}
                {order.special_instructions && (
                  <div className="p-2 bg-warning/10 border border-warning/30 rounded-lg">
                    <p className="text-xs text-foreground">
                      <MessageCircle className="w-3 h-3 inline mr-1" />
                      {order.special_instructions}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2 pt-2">
                  <Button 
                    onClick={() => handleStartDelivery(order)}
                    className="flex-1 bg-gradient-neon hover:shadow-neon transition-all"
                  >
                    <Route className="w-4 h-4 mr-2" />
                    Start Delivery
                  </Button>
                  <Button variant="outline" size="icon" className="border-border">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="border-border">
                    <User className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default MyDeliveries;