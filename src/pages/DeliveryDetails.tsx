import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Clock, 
  Calendar,
  Navigation,
  CheckCircle2,
  Package,
  User,
  CreditCard,
  AlertCircle
} from "lucide-react";

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: any;
  items: any[];
  total: number;
  payment_status: string;
  delivery_date: string;
  delivery_time_slot?: string;
  special_instructions?: string;
  status: string;
  created_at: string;
}

const DeliveryDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      
      // Transform the data to match our interface
      const transformedOrder = {
        ...data,
        items: Array.isArray(data.items) ? data.items : []
      };
      
      setOrder(transformedOrder);
    } catch (error) {
      console.error('Error fetching order details:', error);
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!order) return;
    
    setIsMarkingDelivered(true);
    try {
      // Get current agent
      const agentEmail = localStorage.getItem('agent_email') || 'seshethoti@gmail.com';
      
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', agentEmail)
        .eq('is_active', true)
        .single();

      if (!agent) {
        throw new Error('Agent not found');
      }

      // Update order as delivered
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          delivered: true, 
          delivered_at: new Date().toISOString(),
          status: 'delivered'
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Create delivery history entry
      const { error: historyError } = await supabase
        .from('delivery_history')
        .insert({
          order_id: order.id,
          agent_id: agent.id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          delivery_address: order.address,
          items: order.items,
          total_amount: order.total,
          payment_status: order.payment_status,
          delivery_date: order.delivery_date,
          delivery_time_slot: order.delivery_time_slot,
          special_instructions: order.special_instructions,
          completed_at: new Date().toISOString()
        });

      if (historyError) throw historyError;

      // Create earnings entry
      const earningAmount = Math.round(order.total * 0.15 * 100) / 100; // 15% commission
      const { error: earningsError } = await supabase
        .from('earnings')
        .insert({
          agent_id: agent.id,
          order_id: order.id,
          amount: earningAmount,
          status: 'confirmed'
        });

      if (earningsError) throw earningsError;

      toast({
        title: "Success",
        description: "Order marked as delivered successfully!",
      });

      navigate('/history');
    } catch (error) {
      console.error('Error marking order as delivered:', error);
      toast({
        title: "Error",
        description: "Failed to mark order as delivered",
        variant: "destructive"
      });
    } finally {
      setIsMarkingDelivered(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </div>
    );
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'paid_online':
        return 'bg-green-500/20 text-green-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4 animate-fade-in">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Delivery Details</h1>
          <p className="text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2 animate-slide-up">
        <Badge variant="outline" className="border-primary/20">
          PENDING
        </Badge>
        <Badge className={`${getPaymentStatusColor(order.payment_status)} border-0`}>
          {order.payment_status.toUpperCase().replace('_', ' ')}
        </Badge>
      </div>

      {/* Customer Information */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <User className="w-5 h-5 text-primary" />
            <span>Customer Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer Name</p>
              <p className="font-medium text-foreground">{order.customer_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivery Address</p>
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="font-medium text-foreground">
                  {order.address?.addressLine1}, {order.address?.city} - {order.address?.pincode}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Contact Number</p>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-primary" />
                <p className="font-medium text-foreground">{order.customer_phone}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-primary" />
                <p className="font-medium text-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {order.delivery_time_slot && (
            <div>
              <p className="text-sm text-muted-foreground">Time Slot</p>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-primary" />
                <p className="font-medium text-foreground">{order.delivery_time_slot}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-primary" />
            <span>Order Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {order.items?.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.name || 'Product'}</p>
                  <p className="text-sm text-muted-foreground">Qty: {item.quantity || 1}</p>
                </div>
              </div>
              <p className="font-bold text-foreground">₹{item.price || item.total || order.total}</p>
            </div>
          ))}
          
          <div className="border-t border-border pt-4">
            <div className="flex justify-between items-center">
              <p className="text-lg font-bold text-foreground">Total Amount</p>
              <p className="text-xl font-bold text-primary">₹{order.total}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details */}
      <Card className="bg-card border-border animate-slide-up">
        <CardContent className="p-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <span>PAYMENT DETAILS</span>
            </h3>
            
            <div className="flex justify-between items-center">
              <span className="font-medium text-foreground">Payment Method:</span>
              <Badge variant="outline" className="border-border">
                PENDING
              </Badge>
            </div>

            <div className="flex items-center space-x-2 text-amber-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Payment status pending confirmation</span>
            </div>

            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Payment pending - collect on delivery
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Special Instructions */}
      {order.special_instructions && (
        <Card className="bg-card border-border animate-slide-up">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-2">Special Instructions</h3>
            <p className="text-muted-foreground">{order.special_instructions}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="fixed bottom-4 left-4 right-4 flex gap-4 animate-slide-up">
        <Button 
          variant="outline" 
          className="flex-1 border-border"
          onClick={() => {
            // Navigate to map/tracking
            toast({
              title: "Navigation",
              description: "Opening navigation...",
            });
          }}
        >
          <Navigation className="w-4 h-4 mr-2" />
          Navigate
        </Button>
        
        <Button 
          className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth"
          onClick={handleMarkDelivered}
          disabled={isMarkingDelivered}
        >
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {isMarkingDelivered ? "Marking..." : "Mark as Delivered"}
        </Button>
      </div>

      {/* Add bottom padding to account for fixed buttons */}
      <div className="h-20"></div>
    </div>
  );
};

export default DeliveryDetails;