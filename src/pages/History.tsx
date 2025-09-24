import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeAddress } from "@/lib/utils";
import { debugAddress } from "@/lib/debugAddress";
import { 
  MapPin, 
  Clock, 
  IndianRupee, 
  Package, 
  CheckCircle,
  Star,
  Search,
  Filter,
  X
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
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Filter deliveries based on search and filters
  const filteredDeliveries = deliveries.filter(delivery => {
    // Search filter
    const matchesSearch = searchTerm === "" || 
      delivery.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      normalizeAddress(delivery.delivery_address).toLowerCase().includes(searchTerm.toLowerCase());

    // Payment filter
    const matchesPayment = paymentFilter === "all" || 
      (paymentFilter === "online" && delivery.payment_status === "paid_online") ||
      (paymentFilter === "cod" && delivery.payment_status === "paid_cod") ||
      (paymentFilter === "pending" && !["paid_online", "paid_cod"].includes(delivery.payment_status));

    // Date filter
    const deliveryDate = new Date(delivery.completed_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const matchesDate = dateFilter === "all" ||
      (dateFilter === "today" && deliveryDate.toDateString() === today.toDateString()) ||
      (dateFilter === "yesterday" && deliveryDate.toDateString() === yesterday.toDateString()) ||
      (dateFilter === "week" && deliveryDate >= weekAgo) ||
      (dateFilter === "month" && deliveryDate >= monthAgo);

    return matchesSearch && matchesPayment && matchesDate;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setPaymentFilter("all");
    setDateFilter("all");
    setShowFilters(false);
  };

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

  // Calculate agent payout (base 40 for first 3km + 9 per km beyond 3km, minus platform fee)
  const calculateAgentPayout = (distance: number = 1, products: number = 1) => {
    const basePay = 40; // Base pay for first 3 km
    const additionalDistance = Math.max(0, distance - 3); // Distance beyond 3 km
    const perKmRate = 9; // Rate per km for new pricing
    const distancePay = additionalDistance * perKmRate;
    const subtotal = basePay + distancePay;
    
    // Apply basic peak hour check (approximation for frontend)
    const currentHour = new Date().getHours();
    const isWeekend = [0, 6].includes(new Date().getDay());
    const isPeak = (currentHour >= 12 && currentHour < 14) || (currentHour >= 19 && currentHour < 22) || isWeekend;
    
    // Apply surge if peak hours
    const surgeAmount = isPeak ? subtotal * 0.15 : 0;
    const totalWithSurge = subtotal + surgeAmount;
    
    // Agent gets total minus platform fee (₹13)
    const platformFee = 13;
    const agentPayout = Math.max(0, totalWithSurge - platformFee);
    
    return Math.round(agentPayout * 100) / 100; // Round to 2 decimal places
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
          {/* Search and Filter Section */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, order ID, or address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-card/50 border-border"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              
              {(searchTerm || paymentFilter !== "all" || dateFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </Button>
              )}
              
              <span className="text-sm text-muted-foreground ml-auto">
                {filteredDeliveries.length} of {deliveries.length} deliveries
              </span>
            </div>

            {/* Filter Options */}
            {showFilters && (
              <Card className="bg-card/50 border-border animate-slide-down">
                <CardContent className="p-4 space-y-4">
                  {/* Payment Filter */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Payment Status
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: "all", label: "All" },
                        { value: "online", label: "Online" },
                        { value: "cod", label: "COD" },
                        { value: "pending", label: "Pending" }
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={paymentFilter === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPaymentFilter(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Date Filter */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Time Period
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: "all", label: "All Time" },
                        { value: "today", label: "Today" },
                        { value: "yesterday", label: "Yesterday" },
                        { value: "week", label: "This Week" },
                        { value: "month", label: "This Month" }
                      ].map((option) => (
                        <Button
                          key={option.value}
                          variant={dateFilter === option.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDateFilter(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Delivery History List */}
          <div className="animate-slide-up">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredDeliveries.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {deliveries.length === 0 ? "No deliveries yet" : "No matching deliveries"}
                  </h3>
                  <p className="text-muted-foreground">
                    {deliveries.length === 0 
                      ? "Your completed deliveries will appear here"
                      : "Try adjusting your search or filters"
                    }
                  </p>
                  {deliveries.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearFilters}
                      className="mt-4"
                    >
                      Clear filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDeliveries.map((delivery, index) => (
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
                          {debugAddress(delivery.delivery_address, `history-${delivery.id}`)}
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