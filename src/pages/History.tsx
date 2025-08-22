import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  MapPin, 
  Clock, 
  IndianRupee, 
  Package, 
  CheckCircle,
  Star
} from "lucide-react";

interface DeliveryHistoryItem {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: any;
  items: any;
  total_amount: number;
  payment_status: string;
  delivery_date: string;
  completed_at: string;
  customer_rating?: number;
  delivery_notes?: string;
  distance_traveled?: number;
  delivery_payout?: number;
}

const History = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<DeliveryHistoryItem[]>([]);
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);

  // Get current agent ID
  const getCurrentAgent = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .single();

      return agent?.id || null;
    } catch (error) {
      console.error('Error getting current agent:', error);
      return null;
    }
  };

  // Fetch delivery history from backend for current agent only
  const fetchDeliveryHistory = async () => {
    try {
      const agentId = await getCurrentAgent();
      if (!agentId) {
        setDeliveries([]);
        setIsLoading(false);
        return;
      }

      setCurrentAgentId(agentId);

      const { data, error } = await supabase
        .from('delivery_history')
        .select('*')
        .eq('agent_id', agentId)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      setDeliveries(data || []);
    } catch (error) {
      console.error('Error fetching delivery history:', error);
      toast({
        title: "Error",
        description: "Failed to load delivery history",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryHistory();

    // Listen for order completion events from QR scanner and other delivery methods
    const handleOrderCompleted = () => {
      console.log('Order completed event received, refreshing history...');
      fetchDeliveryHistory();
    };

    window.addEventListener('orderCompleted', handleOrderCompleted);

    // Set up real-time subscription for new deliveries
    let channel: any = null;
    
    const setupRealtimeSubscription = async () => {
      const agentId = await getCurrentAgent();
      if (!agentId) return;

      channel = supabase
        .channel('delivery-history-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'delivery_history',
            filter: `agent_id=eq.${agentId}`
          },
          (payload) => {
            console.log('New delivery added:', payload);
            const newDelivery = payload.new as DeliveryHistoryItem;
            setDeliveries(prev => [newDelivery, ...prev]);
            
            toast({
              title: "New Delivery Added! ✅",
              description: `Delivery for ${newDelivery.customer_name} added to history`,
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'delivery_history',
            filter: `agent_id=eq.${agentId}`
          },
          (payload) => {
            console.log('Delivery updated:', payload);
            const updatedDelivery = payload.new as DeliveryHistoryItem;
            setDeliveries(prev => 
              prev.map(delivery => 
                delivery.id === updatedDelivery.id ? updatedDelivery : delivery
              )
            );
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      window.removeEventListener('orderCompleted', handleOrderCompleted);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Calculate agent payout (base 20 + 15 per km beyond 1km)
  const calculateAgentPayout = (distance: number = 1, products: number = 1) => {
    const basePay = 20; // Base pay for first 1 km
    const additionalDistance = Math.max(0, distance - 1); // Distance beyond 1 km
    const perKmRate = 15; // Rate per km for fair pricing
    const distancePay = additionalDistance * perKmRate;
    
    return basePay + distancePay;
  };

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <Card key={i} className="bg-card/50 border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="space-y-2 mb-4">
              <Skeleton className="h-3 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-lg border-b border-primary/20 shadow-neon sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-foreground">
              Delivery History
            </h1>
            <p className="text-sm text-muted-foreground">
              Your completed deliveries
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <span className="text-sm font-medium text-foreground">
              {deliveries.length} completed
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Delivery History List */}
          <div className="animate-slide-up">
            {isLoading ? (
              <LoadingSkeleton />
            ) : deliveries.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No deliveries yet</h3>
                  <p className="text-muted-foreground">
                    Your completed deliveries will appear here
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {deliveries.map((delivery, index) => (
                  <Card 
                    key={delivery.id} 
                    className="bg-card border-border hover:shadow-neon transition-all duration-300 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="p-4">
                      {/* Delivery Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground">{delivery.customer_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Order #{delivery.order_id?.substring(0, 8)}...
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                            Delivered
                          </Badge>
                          {delivery.customer_rating && (
                            <div className="flex items-center">
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              <span className="text-sm text-muted-foreground ml-1">
                                {delivery.customer_rating}/5
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Delivery Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2 text-primary" />
                          {delivery.delivery_address?.addressLine1}, {delivery.delivery_address?.city}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <Clock className="w-4 h-4 mr-1 text-primary" />
                            {new Date(delivery.completed_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-muted-foreground">
                            <Package className="w-4 h-4 mr-1 text-primary" />
                            {Array.isArray(delivery.items) ? delivery.items.length : 1} products
                          </div>
                          <div className="flex items-center text-primary font-semibold">
                            <IndianRupee className="w-4 h-4 mr-1" />
                            ₹{delivery.total_amount}
                          </div>
                        </div>
                        
                        {/* Agent Payout */}
                        <div className="flex items-center text-sm text-green-600 font-medium mt-2">
                          <IndianRupee className="w-4 h-4 mr-1" />
                          Earned: ₹{delivery.delivery_payout || calculateAgentPayout(delivery.distance_traveled || 2.5)}
                        </div>

                        {/* Delivery Notes */}
                        {delivery.delivery_notes && (
                          <div className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded">
                            <strong>Notes:</strong> {delivery.delivery_notes}
                          </div>
                        )}
                      </div>

                      {/* Payment Status */}
                      <div className="flex items-center justify-between">
                        <Badge 
                          className={`${
                            delivery.payment_status === 'paid_online' 
                              ? 'bg-green-500/20 text-green-600 border-green-500/30'
                              : delivery.payment_status === 'paid_cod'
                              ? 'bg-blue-500/20 text-blue-600 border-blue-500/30'
                              : 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30'
                          }`}
                        >
                          {delivery.payment_status === 'paid_online' ? 'Paid Online' :
                           delivery.payment_status === 'paid_cod' ? 'Cash on Delivery' :
                           'Pending Payment'}
                        </Badge>
                        
                        <span className="text-xs text-muted-foreground">
                          {new Date(delivery.completed_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default History;