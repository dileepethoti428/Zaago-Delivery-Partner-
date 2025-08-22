import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Package, 
  Navigation,
  Star,
  Zap
} from "lucide-react";

const Home = () => {
  const [isOnline, setIsOnline] = useState(false);
  const navigate = useNavigate();

  const mockOrders = [
    {
      id: "ORD001",
      restaurant: "Pizza Palace",
      customer: "John Smith",
      address: "123 Main St, Downtown",
      amount: "$24.50",
      distance: "1.2 km",
      time: "15 min",
      status: "ready"
    },
    {
      id: "ORD002", 
      restaurant: "Burger Hub",
      customer: "Sarah Wilson",
      address: "456 Oak Ave, Midtown",
      amount: "$18.75",
      distance: "2.1 km", 
      time: "20 min",
      status: "preparing"
    }
  ];

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header Status */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Good evening!</h1>
          <p className="text-muted-foreground">Ready to start earning?</p>
        </div>
        
        <Button
          onClick={() => setIsOnline(!isOnline)}
          variant={isOnline ? "default" : "secondary"}
          className={`${
            isOnline 
              ? "bg-gradient-neon shadow-neon" 
              : "bg-secondary hover:bg-secondary/80"
          } transition-smooth`}
        >
          <Zap className="w-4 h-4 mr-2" />
          {isOnline ? "Online" : "Go Online"}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 animate-slide-up">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-xl font-bold text-foreground">$127.50</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deliveries</p>
                <p className="text-xl font-bold text-foreground">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Orders */}
      <div className="animate-slide-up">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Available Orders
        </h2>
        
        <div className="space-y-4">
          {mockOrders.map((order) => (
            <Card key={order.id} className="bg-card border-border hover:shadow-elevated transition-smooth">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{order.restaurant}</h3>
                    <p className="text-sm text-muted-foreground">Order #{order.id}</p>
                  </div>
                  <Badge 
                    variant={order.status === "ready" ? "default" : "secondary"}
                    className={order.status === "ready" ? "bg-primary text-primary-foreground" : ""}
                  >
                    {order.status}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mr-2" />
                    {order.address}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="w-4 h-4 mr-1" />
                      {order.time}
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Navigation className="w-4 h-4 mr-1" />
                      {order.distance}
                    </div>
                    <div className="flex items-center text-primary font-semibold">
                      <DollarSign className="w-4 h-4 mr-1" />
                      {order.amount}
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
              <Button 
                onClick={() => navigate('/order-details')}
                className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth"
              >
                Accept Order
              </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="border-border hover:bg-secondary"
                  >
                    <MapPin className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      {!isOnline && (
        <Card className="bg-gradient-dark border-primary/20 animate-slide-up">
          <CardContent className="p-4 text-center">
            <Zap className="w-12 h-12 text-primary mx-auto mb-3 animate-glow-pulse" />
            <h3 className="font-semibold text-foreground mb-2">Ready to earn?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Go online to start receiving delivery requests
            </p>
            <Button 
              onClick={() => setIsOnline(true)}
              className="bg-gradient-neon hover:shadow-neon transition-smooth"
            >
              Start Delivering
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Home;