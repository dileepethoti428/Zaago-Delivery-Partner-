import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Package, 
  DollarSign, 
  Star, 
  AlertTriangle, 
  Gift,
  Settings,
  Check,
  Trash2,
  Clock
} from "lucide-react";

const Notifications = () => {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "order",
      title: "New Order Available",
      message: "Pizza Palace - $24.50 delivery ready for pickup",
      time: "2 minutes ago",
      read: false,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      id: 2,
      type: "earning",
      title: "Weekly Earnings Summary",
      message: "You earned $892.35 this week! Great work!",
      time: "1 hour ago",
      read: false,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      id: 3,
      type: "rating",
      title: "New 5-Star Rating",
      message: "John Smith rated you 5 stars with tip: 'Fast and friendly!'",
      time: "3 hours ago",
      read: true,
      icon: Star,
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      id: 4,
      type: "alert",
      title: "Weather Alert",
      message: "Heavy rain expected. Drive safely and consider surge pricing.",
      time: "5 hours ago",
      read: true,
      icon: AlertTriangle,
      color: "text-destructive",
      bgColor: "bg-destructive/10"
    },
    {
      id: 5,
      type: "promotion",
      title: "Bonus Opportunity",
      message: "Complete 5 more deliveries today for a $20 bonus!",
      time: "1 day ago",
      read: true,
      icon: Gift,
      color: "text-primary",
      bgColor: "bg-primary/10"
    }
  ]);

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          className="border-border hover:bg-secondary"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Action Buttons */}
      {unreadCount > 0 && (
        <div className="flex space-x-3 animate-slide-up">
          <Button
            onClick={markAllAsRead}
            className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-4 animate-slide-up">
        {notifications.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No notifications</h3>
              <p className="text-muted-foreground">You're all caught up! Check back later for updates.</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => {
            const IconComponent = notification.icon;
            return (
              <Card 
                key={notification.id} 
                className={`bg-card border-border transition-smooth hover:shadow-elevated ${
                  !notification.read ? "border-primary/50 shadow-sm" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className={`p-2 ${notification.bgColor} rounded-lg flex-shrink-0 mt-1`}>
                      <IconComponent className={`w-5 h-5 ${notification.color}`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className={`font-semibold ${
                            !notification.read ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {notification.title}
                          </h4>
                          <p className={`text-sm mt-1 ${
                            !notification.read ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {notification.time}
                            </span>
                            {!notification.read && (
                              <Badge className="bg-primary text-primary-foreground text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex space-x-1 ml-4">
                          {!notification.read && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => markAsRead(notification.id)}
                              className="h-8 w-8 hover:bg-primary/10"
                            >
                              <Check className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteNotification(notification.id)}
                            className="h-8 w-8 hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Notification Categories */}
      <Card className="bg-card border-border animate-slide-up">
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">New Orders</p>
                <p className="text-sm text-muted-foreground">Get notified about available deliveries</p>
              </div>
            </div>
            <div className="w-2 h-2 bg-primary rounded-full"></div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-5 h-5 text-success" />
              <div>
                <p className="font-medium text-foreground">Earnings</p>
                <p className="text-sm text-muted-foreground">Weekly summaries and milestones</p>
              </div>
            </div>
            <div className="w-2 h-2 bg-success rounded-full"></div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Star className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">Ratings & Reviews</p>
                <p className="text-sm text-muted-foreground">Customer feedback notifications</p>
              </div>
            </div>
            <div className="w-2 h-2 bg-warning rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;