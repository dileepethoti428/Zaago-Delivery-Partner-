import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Clock, 
  DollarSign,
  Navigation,
  Package,
  Star,
  MessageCircle
} from "lucide-react";

const OrderDetails = () => {
  const navigate = useNavigate();

  const orderData = {
    id: "ORD001",
    restaurant: {
      name: "Pizza Palace",
      address: "789 Restaurant Row, Food District",
      phone: "+1 (555) 123-4567"
    },
    customer: {
      name: "John Smith",
      address: "123 Main St, Apt 4B, Downtown",
      phone: "+1 (555) 987-6543",
      instructions: "Please ring doorbell twice. Leave at door if no answer."
    },
    items: [
      { name: "Large Pepperoni Pizza", quantity: 1, price: 18.99 },
      { name: "Garlic Bread", quantity: 2, price: 4.50 },
      { name: "Coca Cola 2L", quantity: 1, price: 2.99 }
    ],
    total: "$24.50",
    distance: "1.2 km",
    estimatedTime: "15 min",
    status: "ready"
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 animate-fade-in">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/home')}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Order Details</h1>
            <p className="text-sm text-muted-foreground">#{orderData.id}</p>
          </div>
          <div className="ml-auto">
            <Badge className="bg-primary text-primary-foreground">
              {orderData.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Order Status */}
        <Card className="bg-gradient-dark border-primary/20 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Package className="w-5 h-5 text-primary animate-glow-pulse" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Ready for Pickup</p>
                  <p className="text-sm text-muted-foreground">Order is prepared and waiting</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{orderData.total}</p>
                <p className="text-sm text-muted-foreground">{orderData.estimatedTime}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Info */}
        <Card className="bg-card border-border animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-primary" />
              <span>Pickup Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold text-foreground">{orderData.restaurant.name}</p>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                <MapPin className="w-4 h-4 mr-2" />
                {orderData.restaurant.address}
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth">
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
              <Button variant="outline" size="icon" className="border-border">
                <Phone className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card className="bg-card border-border animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-primary" />
              <span>Delivery Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold text-foreground">{orderData.customer.name}</p>
              <p className="text-sm text-muted-foreground flex items-center mt-1">
                <MapPin className="w-4 h-4 mr-2" />
                {orderData.customer.address}
              </p>
            </div>
            
            {orderData.customer.instructions && (
              <div className="p-3 bg-secondary/50 rounded-lg">
                <p className="text-sm font-medium text-foreground mb-1">Delivery Instructions:</p>
                <p className="text-sm text-muted-foreground">{orderData.customer.instructions}</p>
              </div>
            )}
            
            <div className="flex space-x-2">
              <Button className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth">
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
              <Button variant="outline" size="icon" className="border-border">
                <Phone className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" className="border-border">
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="bg-card border-border animate-slide-up">
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderData.items.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-foreground">${item.price}</p>
                </div>
              ))}
              
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-foreground">Total</p>
                  <p className="font-bold text-primary text-lg">{orderData.total}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3 animate-slide-up">
          <Button 
            onClick={() => navigate('/tracking')}
            className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
          >
            Start Delivery
          </Button>
          
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1 border-border">
              Report Issue
            </Button>
            <Button variant="outline" className="flex-1 border-border">
              Cancel Order
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;