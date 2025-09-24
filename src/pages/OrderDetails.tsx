import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import MapPreview from "@/components/MapPreview";
import { debugAddress } from "@/lib/debugAddress";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Clock, 
  DollarSign,
  Navigation,
  Package,
  Star,
  MessageCircle,
  User,
  AlertTriangle,
  CheckCircle,
  X,
  Eye,
  Timer,
  ShoppingBag,
  Route,
  Zap
} from "lucide-react";

interface OrderData {
  order_id?: string;
  customer_name: string;
  customer_address?: string;
  customer_phone: string;
  distance_km?: number;
  estimated_time?: string;
  items: any[];
  total_amount: number;
  priority_level?: string;
  status: string;
  special_instructions?: string;
  restaurant?: string;
  restaurant_address?: string;
  restaurant_phone?: string;
  time_left?: string;
  customer_rating?: number;
  delivery_fee?: number;
  address?: any;
  total?: number;
  id?: string;
}

const OrderDetails = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  
  // State management
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customerRating, setCustomerRating] = useState<number | null>(null);

  // Fetch order data from backend
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        toast({
          title: "Error",
          description: "No order ID provided",
          variant: "destructive"
        });
        navigate('/home');
        return;
      }

      try {
        setIsLoading(true);
        
        // Fetch order details
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          toast({
            title: "Error",
            description: "Order not found",
            variant: "destructive"
          });
          navigate('/home');
          return;
        }

        // Get customer rating from delivery_agent_ratings if order is completed
        let rating = null;
        if (order.status === 'delivered') {
          const { data: ratingData } = await supabase
            .from('delivery_history')
            .select('customer_rating')
            .eq('order_id', orderId)
            .single();
          
          if (ratingData && ratingData.customer_rating) {
            rating = ratingData.customer_rating;
          }
        }

        // Transform order data to match component interface
        const transformedOrder: OrderData = {
          id: order.id,
          order_id: order.id,
          customer_name: order.customer_name || 'Unknown Customer',
          customer_phone: order.customer_phone || '',
          customer_address: typeof order.address === 'string' 
            ? order.address 
            : (order.address as any)?.full_address || 'Address not available',
          items: Array.isArray(order.items) ? order.items : [],
          total_amount: order.total || 0,
          total: order.total || 0,
          status: order.status || 'pending',
          special_instructions: order.special_instructions || '',
          address: order.address,
          priority_level: 'Medium', // Default priority
          delivery_fee: 0, // Default delivery fee
          customer_rating: rating
        };

        setOrderData(transformedOrder);
        setCustomerRating(rating);
        
      } catch (error) {
        console.error('Error fetching order:', error);
        toast({
          title: "Error",
          description: "Failed to load order details",
          variant: "destructive"
        });
        navigate('/home');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, toast, navigate]);

  // Get priority color based on level
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-500/50',
          text: 'text-red-400',
          badge: 'bg-red-500 text-red-50',
          glow: 'shadow-red-500/30'
        };
      case 'Medium':
        return {
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          badge: 'bg-yellow-500 text-yellow-50',
          glow: 'shadow-yellow-500/30'
        };
      case 'Low':
        return {
          bg: 'bg-green-500/20',
          border: 'border-green-500/50',
          text: 'text-green-400',
          badge: 'bg-green-500 text-green-50',
          glow: 'shadow-green-500/30'
        };
      default:
        return {
          bg: 'bg-primary/20',
          border: 'border-primary/50',
          text: 'text-primary',
          badge: 'bg-primary text-primary-foreground',
          glow: 'shadow-primary/30'
        };
    }
  };

  const priorityColors = orderData ? getPriorityColor(orderData.priority_level || 'Medium') : getPriorityColor('Medium');

  // Handle accept order
  const handleAcceptOrder = async () => {
    setIsAccepting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Order Accepted!",
      description: `Order ${orderData.order_id} has been assigned to you`,
    });
    
    setIsAccepting(false);
    navigate('/tracking');
  };

  // Handle reject order
  const handleRejectOrder = async () => {
    setIsRejecting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Order Rejected",
      description: `Order ${orderData.order_id} has been declined`,
      variant: "destructive",
    });
    
    setIsRejecting(false);
    navigate('/home');
  };

  // Handle track order
  const handleTrackOrder = () => {
    navigate(`/tracking?id=${orderData.order_id}`);
  };

  // Calculate total with delivery fee
  const finalTotal = orderData ? (orderData.total_amount || 0) + (orderData.delivery_fee || 0) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Enhanced Header with Priority Indicator */}
      <div className={`sticky top-0 bg-card/90 backdrop-blur-lg border-b ${priorityColors.border} shadow-lg z-50`}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/home')}
              className="hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Button>
            <div className="animate-fade-in">
              <h1 className="text-xl font-bold text-foreground">Order Details</h1>
              <p className="text-sm text-muted-foreground">#{orderData.order_id}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Time Left Indicator */}
            <div className="flex items-center space-x-2 bg-destructive/10 px-3 py-1 rounded-full">
              <Timer className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">{orderData.time_left}</span>
            </div>
            
            {/* Priority Badge */}
            <Badge className={`${priorityColors.badge} animate-pulse font-semibold`}>
              {orderData.priority_level} Priority
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Priority Alert Card */}
          {orderData.priority_level === 'High' && (
            <Card className={`${priorityColors.bg} ${priorityColors.border} animate-slide-up shadow-lg ${priorityColors.glow}`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className={`w-6 h-6 ${priorityColors.text} animate-pulse`} />
                  <div>
                    <p className="font-semibold text-foreground">High Priority Order!</p>
                    <p className="text-sm text-muted-foreground">Customer needs this order urgently</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card className="bg-card border-border animate-slide-up shadow-neon hover:shadow-neon-strong transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-primary" />
                  <span>Customer Details</span>
                </div>
                {customerRating && (
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm font-medium text-foreground">{customerRating.toFixed(1)}</span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{orderData.customer_name}</h3>
                <div className="flex items-center text-muted-foreground mt-1">
                  <MapPin className="w-4 h-4 mr-2 text-primary" />
                  <span className="text-sm">{debugAddress(orderData.customer_address, 'order-details')}</span>
                </div>
                <div className="flex items-center text-muted-foreground mt-1">
                  <Navigation className="w-4 h-4 mr-2 text-primary" />
                  <span className="text-sm">{orderData.distance_km} km • {orderData.estimated_time}</span>
                </div>
              </div>

              {/* Special Instructions */}
              {orderData.special_instructions && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <MessageCircle className="w-4 h-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Special Instructions:</p>
                      <p className="text-sm text-muted-foreground mt-1">{orderData.special_instructions}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="border-border hover:bg-primary/10 hover:border-primary transition-all duration-300"
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="border-border hover:bg-primary/10 hover:border-primary transition-all duration-300"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Map Preview */}
          <Card className="bg-card border-border animate-slide-up overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-primary" />
                <span>Delivery Route</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <MapPreview
                customerAddress={debugAddress(orderData.customer_address, 'order-details-map')}
                onFullScreenOpen={() => handleTrackOrder()}
                className="w-full"
              />
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card className="bg-card border-border animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  <span>Order Items ({orderData.items.length})</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">From {orderData.restaurant}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderData.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted/10 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-foreground">₹{item.price}</p>
                  </div>
                ))}

                {/* Order Summary */}
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">₹{orderData.total_amount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span className="text-foreground">₹{orderData.delivery_fee}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="font-semibold text-foreground">Total Amount</span>
                    <span className="text-xl font-bold text-primary">₹{finalTotal}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3 animate-slide-up pb-6">
            {/* Accept Order Button */}
            <Button 
              onClick={handleAcceptOrder}
              disabled={isAccepting || isRejecting}
              className="w-full bg-gradient-neon hover:shadow-neon hover:scale-105 transition-all duration-300 h-12 text-lg font-semibold"
            >
              {isAccepting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Accepting Order...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Accept Order</span>
                </div>
              )}
            </Button>

            {/* Secondary Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline"
                onClick={handleRejectOrder}
                disabled={isAccepting || isRejecting}
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive transition-all duration-300"
              >
                {isRejecting ? (
                  <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="flex items-center space-x-1">
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </div>
                )}
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleTrackOrder}
                className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300"
              >
                <Route className="w-4 h-4 mr-1" />
                Track
              </Button>
              
              <Button 
                variant="outline"
                className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300"
              >
                <Eye className="w-4 h-4 mr-1" />
                Details
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default OrderDetails;