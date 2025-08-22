import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Navigation, 
  Phone, 
  MessageCircle,
  MapPin,
  Clock,
  CheckCircle,
  Package,
  Truck
} from "lucide-react";

const Tracking = () => {
  const navigate = useNavigate();
  const [deliveryStatus, setDeliveryStatus] = useState("en_route"); // picked_up, en_route, delivered

  const handleStatusUpdate = (status: string) => {
    setDeliveryStatus(status);
  };

  const getStatusConfig = () => {
    switch (deliveryStatus) {
      case "picked_up":
        return {
          title: "Order Picked Up",
          subtitle: "Heading to customer",
          icon: Package,
          color: "text-warning",
          bgColor: "bg-warning/10"
        };
      case "en_route":
        return {
          title: "On the Way",
          subtitle: "Delivering to customer",
          icon: Truck,
          color: "text-primary",
          bgColor: "bg-primary/10"
        };
      case "delivered":
        return {
          title: "Delivered",
          subtitle: "Order completed successfully",
          icon: CheckCircle,
          color: "text-success",
          bgColor: "bg-success/10"
        };
      default:
        return {
          title: "En Route",
          subtitle: "On the way",
          icon: Navigation,
          color: "text-primary",
          bgColor: "bg-primary/10"
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 animate-fade-in">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/order-details')}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Live Tracking</h1>
            <p className="text-sm text-muted-foreground">Order #ORD001</p>
          </div>
          <div className="ml-auto">
            <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
              {deliveryStatus.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="h-96 bg-gradient-dark relative overflow-hidden animate-fade-in">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        
        {/* Mock Map Interface */}
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto animate-glow-pulse">
              <Navigation className="w-10 h-10 text-primary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Live Map View</p>
              <p className="text-sm text-muted-foreground">GPS tracking in progress</p>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="absolute bottom-4 right-4 space-y-2">
          <Button size="icon" className="bg-card/90 hover:bg-card border-border shadow-lg">
            <MapPin className="w-4 h-4" />
          </Button>
          <Button size="icon" className="bg-card/90 hover:bg-card border-border shadow-lg">
            <Navigation className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Current Status */}
        <Card className="bg-gradient-dark border-primary/20 animate-slide-up">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className={`p-3 ${statusConfig.bgColor} rounded-lg`}>
                <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{statusConfig.title}</h3>
                <p className="text-sm text-muted-foreground">{statusConfig.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-primary">ETA: 8 min</p>
                <p className="text-xs text-muted-foreground">1.2 km left</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Progress */}
        <Card className="bg-card border-border animate-slide-up">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Delivery Progress</h3>
            
            <div className="space-y-4">
              {/* Step 1: Pickup */}
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  deliveryStatus !== "picked_up" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Picked up from restaurant</p>
                  <p className="text-sm text-muted-foreground">Pizza Palace - 2:15 PM</p>
                </div>
                <CheckCircle className={`w-5 h-5 ${
                  deliveryStatus !== "picked_up" ? "text-primary" : "text-muted-foreground"
                }`} />
              </div>

              {/* Step 2: En Route */}
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  deliveryStatus === "en_route" ? "bg-primary text-primary-foreground animate-glow-pulse" : "bg-muted"
                }`}>
                  <Truck className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">En route to customer</p>
                  <p className="text-sm text-muted-foreground">123 Main St, Apt 4B</p>
                </div>
                {deliveryStatus === "en_route" && (
                  <Clock className="w-5 h-5 text-primary animate-pulse" />
                )}
              </div>

              {/* Step 3: Delivered */}
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  deliveryStatus === "delivered" ? "bg-success text-white" : "bg-muted"
                }`}>
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Delivered to customer</p>
                  <p className="text-sm text-muted-foreground">
                    {deliveryStatus === "delivered" ? "Completed at 2:32 PM" : "Pending"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Contact */}
        <Card className="bg-card border-border animate-slide-up">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-3">Customer Contact</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">John Smith</p>
                <p className="text-sm text-muted-foreground">123 Main St, Apt 4B</p>
              </div>
              <div className="flex space-x-2">
                <Button size="icon" variant="outline" className="border-border">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="outline" className="border-border">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3 animate-slide-up">
          {deliveryStatus === "en_route" && (
            <Button 
              onClick={() => handleStatusUpdate("delivered")}
              className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
            >
              Mark as Delivered
            </Button>
          )}
          
          {deliveryStatus === "delivered" && (
            <Button 
              onClick={() => navigate('/home')}
              className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
            >
              Complete Delivery
            </Button>
          )}
          
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1 border-border">
              Report Issue
            </Button>
            <Button variant="outline" className="flex-1 border-border">
              Get Help
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tracking;