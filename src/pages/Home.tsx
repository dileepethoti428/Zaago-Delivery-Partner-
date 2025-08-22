import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Package, 
  Navigation,
  Zap,
  Bell,
  User,
  RefreshCw,
  CheckCircle,
  X,
  QrCode
} from "lucide-react";
import { QrScannerDialog } from "@/components/QrScannerDialog";

// Mock data matching the requirements
const mockOrders = [
  {
    order_id: "ORD123",
    customer_name: "Rohit Sharma",
    customer_address: "Sector 21, Phagwara",
    distance_km: 2.5,
    order_value: 250,
    priority_level: "High",
    status: "Pending",
    delivery_time: "30 min",
    items_count: 3,
    restaurant: "Pizza Corner"
  },
  {
    order_id: "ORD124",
    customer_name: "Priya Singh",
    customer_address: "Civil Lines, Jalandhar",
    distance_km: 1.8,
    order_value: 180,
    priority_level: "Medium",
    status: "Pending",
    delivery_time: "25 min",
    items_count: 2,
    restaurant: "Burger House"
  },
  {
    order_id: "ORD125",
    customer_name: "Amit Kumar",
    customer_address: "Model Town, Phagwara",
    distance_km: 3.2,
    order_value: 420,
    priority_level: "High",
    status: "Pending",
    delivery_time: "40 min",
    items_count: 5,
    restaurant: "Royal Dine"
  },
  {
    order_id: "ORD126",
    customer_name: "Neha Gupta",
    customer_address: "Urban Estate, Jalandhar",
    distance_km: 0.8,
    order_value: 95,
    priority_level: "Low",
    status: "Pending",
    delivery_time: "15 min",
    items_count: 1,
    restaurant: "Cafe Delight"
  }
];


const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [orders, setOrders] = useState(mockOrders);
  const [notificationCount] = useState(3);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Show available orders (no filtering needed anymore)
  const availableOrders = orders;

  // Pull to refresh functionality
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Add a new mock order
    const newOrder = {
      order_id: `ORD${Date.now()}`,
      customer_name: "New Customer",
      customer_address: "Fresh Location",
      distance_km: 1.5,
      order_value: 200,
      priority_level: "Medium" as const,
      status: "Pending" as const,
      delivery_time: "20 min",
      items_count: 2,
      restaurant: "New Restaurant"
    };
    
    setOrders(prev => [newOrder, ...prev]);
    setIsRefreshing(false);
    
    toast({
      title: "Orders Updated!",
      description: "New delivery requests available",
    });
  };

  // Accept order
  const handleAcceptOrder = (orderId: string) => {
    setOrders(prev => prev.filter(order => order.order_id !== orderId));
    toast({
      title: "Order Accepted!",
      description: `Order ${orderId} has been assigned to you`,
    });
    navigate('/order-details');
  };

  // Reject order
  const handleRejectOrder = (orderId: string) => {
    setOrders(prev => prev.filter(order => order.order_id !== orderId));
    toast({
      title: "Order Rejected",
      description: `Order ${orderId} has been rejected`,
      variant: "destructive"
    });
  };

  // Priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-destructive text-destructive-foreground animate-pulse';
      case 'Medium':
        return 'bg-warning text-warning-foreground';
      case 'Low':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
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
            <div className="flex space-x-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-12" />
              <Skeleton className="h-10 w-12" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Top App Bar */}
      <div className="bg-card/80 backdrop-blur-lg border-b border-primary/20 shadow-neon sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold text-foreground">
              Zaago Delivery Agent
            </h1>
            <p className="text-sm text-muted-foreground">
              {isOnline ? "You're online and ready!" : "Ready to serve"}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-primary/10"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-5 h-5 text-foreground" />
              {notificationCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-destructive text-destructive-foreground text-xs animate-pulse">
                  {notificationCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10"
              onClick={() => navigate('/profile')}
            >
              <User className="w-5 h-5 text-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Quick Services */}
          <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20 animate-slide-up">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Quick Services</h3>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => setIsOnline(!isOnline)}
                  className={`${
                    isOnline 
                      ? "bg-destructive hover:bg-destructive/80" 
                      : "bg-gradient-neon hover:shadow-neon hover:scale-105"
                  } transition-all duration-300 flex-col h-16`}
                >
                  <Zap className="w-5 h-5 mb-1" />
                  <span className="text-xs">
                    {isOnline ? "Go Offline" : "Go Online"}
                  </span>
                </Button>
                
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                  className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300 flex-col h-16"
                >
                  <RefreshCw className={`w-5 h-5 mb-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="text-xs">Refresh</span>
                </Button>
                
                <Button
                  onClick={() => setShowQrScanner(true)}
                  variant="outline"
                  className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300 flex-col h-16"
                >
                  <QrCode className="w-5 h-5 mb-1" />
                  <span className="text-xs">Scan QR</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Orders List */}
          <div className="animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Available Orders ({availableOrders.length})
              </h2>
            </div>

            {isLoading ? (
              <LoadingSkeleton />
            ) : availableOrders.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
                  <p className="text-muted-foreground mb-4">
                    {isOnline 
                      ? "New orders will appear here" 
                      : "Go online to see available orders"
                    }
                  </p>
                  {!isOnline && (
                    <Button
                      onClick={() => setIsOnline(true)}
                      className="bg-gradient-neon hover:shadow-neon transition-smooth"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Go Online
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {availableOrders.map((order, index) => (
                  <Card 
                    key={order.order_id} 
                    className={`${
                      order.priority_level === 'High' 
                        ? 'bg-gradient-to-r from-card to-destructive/5 border-destructive/30 shadow-lg' 
                        : 'bg-card border-border'
                    } hover:shadow-neon hover:scale-[1.02] transition-all duration-300 animate-fade-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="p-4">
                      {/* Order Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground">{order.customer_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {order.restaurant} • Order #{order.order_id}
                          </p>
                        </div>
                        <Badge className={getPriorityColor(order.priority_level)}>
                          {order.priority_level}
                        </Badge>
                      </div>

                      {/* Order Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 mr-2 text-primary" />
                          {order.customer_address}
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <Navigation className="w-4 h-4 mr-1 text-primary" />
                            {order.distance_km} km
                          </div>
                          <div className="flex items-center text-muted-foreground">
                            <Clock className="w-4 h-4 mr-1 text-primary" />
                            {order.delivery_time}
                          </div>
                          <div className="flex items-center text-muted-foreground">
                            <Package className="w-4 h-4 mr-1 text-primary" />
                            {order.items_count} items
                          </div>
                          <div className="flex items-center text-primary font-semibold">
                            <DollarSign className="w-4 h-4 mr-1" />
                            ₹{order.order_value}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        <Button 
                          onClick={() => handleAcceptOrder(order.order_id)}
                          className="flex-1 bg-gradient-neon hover:shadow-neon hover:scale-105 transition-all duration-300"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Accept
                        </Button>
                        
                        <Button 
                          variant="outline"
                          onClick={() => handleRejectOrder(order.order_id)}
                          className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 hover:shadow-neon transition-all duration-300"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* QR Scanner Dialog */}
      <QrScannerDialog 
        open={showQrScanner} 
        onOpenChange={setShowQrScanner} 
      />
    </div>
  );
};

export default Home;