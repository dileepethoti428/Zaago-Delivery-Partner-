import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Truck,
  Star,
  ArrowUpRight,
  Wallet,
  CreditCard,
  Download
} from "lucide-react";

const Earnings = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("today");

  const earningsData = {
    today: { amount: 127.50, deliveries: 12, hours: 6.5 },
    week: { amount: 892.35, deliveries: 87, hours: 42.3 },
    month: { amount: 3567.80, deliveries: 342, hours: 168.7 }
  };

  const recentEarnings = [
    { id: "ORD001", restaurant: "Pizza Palace", amount: 24.50, time: "2:45 PM", tip: 5.00 },
    { id: "ORD002", restaurant: "Burger Hub", amount: 18.75, time: "2:15 PM", tip: 3.25 },
    { id: "ORD003", restaurant: "Thai Garden", amount: 32.10, time: "1:30 PM", tip: 6.50 },
    { id: "ORD004", restaurant: "Coffee Corner", amount: 12.25, time: "12:45 PM", tip: 2.00 }
  ];

  const currentData = earningsData[selectedPeriod as keyof typeof earningsData];

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Earnings</h1>
        <p className="text-muted-foreground">Track your delivery income</p>
      </div>

      {/* Quick Stats */}
      <Card className="bg-gradient-dark border-primary/20 animate-slide-up">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <DollarSign className="w-8 h-8 text-primary animate-glow-pulse" />
              <span className="text-3xl font-bold text-foreground">
                ${currentData.amount.toFixed(2)}
              </span>
            </div>
            <p className="text-muted-foreground mb-4">
              {selectedPeriod === "today" ? "Today's Earnings" : 
               selectedPeriod === "week" ? "This Week" : "This Month"}
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{currentData.deliveries}</p>
                <p className="text-sm text-muted-foreground">Deliveries</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{currentData.hours}</p>
                <p className="text-sm text-muted-foreground">Hours</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Selector */}
      <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="animate-slide-up">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 gap-4 animate-slide-up">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg per Hour</p>
                <p className="text-xl font-bold text-foreground">
                  ${(currentData.amount / currentData.hours).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Per Delivery</p>
                <p className="text-xl font-bold text-foreground">
                  ${(currentData.amount / currentData.deliveries).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Earnings */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentEarnings.map((earning) => (
              <div key={earning.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Truck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{earning.restaurant}</p>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{earning.time}</span>
                      <span>•</span>
                      <span>#{earning.id}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-foreground">${earning.amount}</p>
                  {earning.tip > 0 && (
                    <div className="flex items-center space-x-1 text-sm">
                      <Star className="w-3 h-3 text-primary" />
                      <span className="text-primary">+${earning.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payout Section */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-primary" />
            <span>Payout Options</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gradient-dark rounded-lg">
            <div className="flex items-center space-x-3">
              <CreditCard className="w-6 h-6 text-primary" />
              <div>
                <p className="font-medium text-foreground">Bank Account</p>
                <p className="text-sm text-muted-foreground">••••1234 - Weekly</p>
              </div>
            </div>
            <Badge className="bg-primary text-primary-foreground">Active</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button className="bg-gradient-neon hover:shadow-neon transition-smooth">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Cash Out
            </Button>
            <Button variant="outline" className="border-border">
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Earnings;