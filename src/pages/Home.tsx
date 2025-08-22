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
  Star,
  Zap,
  Bell,
  User,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Route
} from "lucide-react";

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

const filterOptions = [
  { id: 'nearest', label: 'Nearest', icon: Navigation },
  { id: 'priority', label: 'Priority', icon: AlertTriangle },
  { id: 'high-value', label: 'High-value', icon: TrendingUp },
  { id: 'express', label: 'Express', icon: Zap }
];

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [orders, setOrders] = useState(mockOrders);
  const [notificationCount] = useState(3);

  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Filter orders based on search and active filter
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.customer_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.order_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (!activeFilter) return true;
    
    switch (activeFilter) {
      case 'nearest':
        return order.distance_km <= 2;
      case 'priority':
        return order.priority_level === 'High';
      case 'high-value':
        return order.order_value >= 300;
      case 'express':
        return parseInt(order.delivery_time) <= 20;
      default:
        return true;
    }
  });

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

  // View order details
  const handleViewDetails = (orderId: string) => {
    navigate(`/order-details?id=${orderId}`);
  };

  // Track order
  const handleTrackOrder = (orderId: string) => {
    navigate(`/tracking?id=${orderId}`);
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
              {getGreeting()}, Agent!
            </h1>
            <p className="text-sm text-muted-foreground">
              {isOnline ? "You're online and ready!" : "Tap to go online"}
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
          {/* Online Status Toggle */}
          <Card className="bg-gradient-to-r from-card to-card/50 border-primary/20 animate-slide-up">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-muted'}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isOnline ? "Online" : "Offline"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOnline ? "Receiving orders" : "Tap to start earning"}
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={() => setIsOnline(!isOnline)}
                  className={`${
                    isOnline 
                      ? "bg-destructive hover:bg-destructive/80" 
                      : "bg-gradient-neon hover:shadow-neon hover:scale-105"
                  } transition-all duration-300`}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isOnline ? "Go Offline" : "Go Online"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search Bar */}
          <div className="relative animate-slide-up">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search orders by customer, address, or order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input/50 border-border focus:border-primary focus:shadow-neon transition-all duration-300"
            />
          </div>

          {/* Filters */}
          <div className="animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Filters</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-primary hover:bg-primary/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            
            <ScrollArea className="w-full">
              <div className="flex space-x-2 pb-2">
                {filterOptions.map((filter) => {
                  const IconComponent = filter.icon;
                  const isActive = activeFilter === filter.id;
                  
                  return (
                    <Button
                      key={filter.id}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveFilter(isActive ? null : filter.id)}
                      className={`${
                        isActive 
                          ? "bg-gradient-neon shadow-neon text-primary-foreground" 
                          : "bg-input/30 border-border hover:bg-input/50 hover:shadow-neon"
                      } transition-all duration-300 whitespace-nowrap`}
                    >
                      <IconComponent className="w-4 h-4 mr-2" />
                      {filter.label}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Orders List */}
          <div className="animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Available Orders ({filteredOrders.length})
              </h2>
              {activeFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilter(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear filter
                </Button>
              )}
            </div>

            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredOrders.length === 0 ? (
              <Card className="bg-card/50 border-border">
                <CardContent className="p-8 text-center">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery || activeFilter 
                      ? "Try adjusting your search or filters" 
                      : isOnline 
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
                {filteredOrders.map((order, index) => (
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
                          Accept Order
                        </Button>
                        
                        <Button 
                          variant="outline"
                          size="icon"
                          onClick={() => handleViewDetails(order.order_id)}
                          className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        <Button 
                          variant="outline"
                          size="icon"
                          onClick={() => handleTrackOrder(order.order_id)}
                          className="border-border hover:bg-secondary hover:shadow-neon transition-all duration-300"
                        >
                          <Route className="w-4 h-4" />
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
    </div>
  );
};

export default Home;