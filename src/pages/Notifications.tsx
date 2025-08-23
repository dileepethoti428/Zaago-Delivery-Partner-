import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  metadata?: any;
}

const Notifications = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Get agent ID
      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('id')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      if (agent) {
        setAgentId(agent.id);
        
        // Fetch agent notifications with source information
        const { data: agentNotifications, error } = await supabase
          .from('agent_notifications')
          .select('*')
          .eq('agent_id', agent.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching notifications:', error);
          return;
        }

        // Map to expected format
        const mappedNotifications = agentNotifications.map(notif => ({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          created_at: notif.created_at,
          read: notif.read,
          metadata: notif.metadata,
          source_type: notif.source_type || 'system',
          source_id: notif.source_id
        }));

        setNotifications(mappedNotifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Fallback static notifications for demo
  const [staticNotifications] = useState([
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

  const markAsRead = async (id: string) => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('agent_notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('agent_id', agentId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        )
      );

      toast({
        title: "Notification marked as read",
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('agent_notifications')
        .delete()
        .eq('id', id)
        .eq('agent_id', agentId);

      if (error) throw error;

      setNotifications(prev => prev.filter(notif => notif.id !== id));

      toast({
        title: "Notification deleted",
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async () => {
    if (!agentId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('agent_notifications')
        .update({ read: true })
        .eq('agent_id', agentId)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));

      toast({
        title: "All notifications marked as read",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Use backend notifications if available, otherwise use static ones
  const displayNotifications = notifications.length > 0 ? notifications : staticNotifications;
  const unreadCount = displayNotifications.filter(n => !n.read).length;

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
      case 'new_order':
      case 'order_assigned': 
        return Package;
      case 'earning': return DollarSign;
      case 'rating': return Star;
      case 'alert': 
      case 'status_update': 
        return AlertTriangle;
      case 'promotion': return Gift;
      case 'admin': return Settings;
      case 'delivery_scheduled':
      case 'system':
      default: return Bell;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        <p className="text-muted-foreground">
          {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
        </p>
      </div>

      {/* Action Buttons */}
      {unreadCount > 0 && (
        <div className="flex space-x-3 animate-slide-up">
          <Button
            onClick={markAllAsRead}
            disabled={loading}
            className="flex-1 bg-gradient-neon hover:shadow-neon transition-smooth"
          >
            <Check className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-4 animate-slide-up">
        {displayNotifications.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No notifications</h3>
              <p className="text-muted-foreground">You're all caught up! Check back later for updates.</p>
            </CardContent>
          </Card>
        ) : (
          displayNotifications.map((notification) => {
            const IconComponent = getNotificationIcon(notification.type);
            const sourceType = notification.metadata?.source_type || notification.source_type || 'system';
            const sourceLabel = sourceType === 'customer' ? 'Customer' : 
                              sourceType === 'seller' ? 'Seller' : 
                              sourceType === 'admin' ? 'Admin' : 'System';
            
            return (
                <Card 
                  key={notification.id} 
                  className={`bg-card border-border transition-smooth hover:shadow-elevated ${
                    !notification.read ? "border-primary/50 shadow-sm" : ""
                  } ${
                    (notification.metadata?.source_type === 'admin' || notification.source_type === 'admin') 
                      ? "ring-2 ring-red-500/20 border-red-500/30" 
                      : ""
                  }`}
                >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0 mt-1">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className={`font-semibold ${
                              !notification.read ? "text-foreground" : "text-muted-foreground"
                            }`}>
                              {notification.title}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className={`text-xs font-semibold ${
                                sourceType === 'customer' ? 'border-blue-500 text-blue-500 bg-blue-50' :
                                sourceType === 'seller' ? 'border-green-500 text-green-500 bg-green-50' :
                                sourceType === 'admin' ? 'border-red-500 text-red-500 bg-red-50 animate-pulse' :
                                'border-gray-500 text-gray-500 bg-gray-50'
                              }`}
                            >
                              {sourceLabel}
                            </Badge>
                          </div>
                          <p className={`text-sm mt-1 ${
                            !notification.read ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {getTimeAgo(notification.created_at)}
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
                              disabled={loading}
                              className="h-8 w-8 hover:bg-primary/10"
                            >
                              <Check className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteNotification(notification.id)}
                            disabled={loading}
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