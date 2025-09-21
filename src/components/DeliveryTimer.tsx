import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Timer, Calendar } from "lucide-react";

interface DeliveryTimerProps {
  deliveryType: 'immediate' | 'scheduled';
  scheduledTime?: string; // For scheduled deliveries
  orderPlacedAt?: Date; // When the order was placed
  className?: string;
  subscriptionId?: string; // For subscription orders
  deliveryTime?: string; // Actual delivery time (formatted like "12:00 PM")
}

const DeliveryTimer = ({ 
  deliveryType, 
  scheduledTime, 
  orderPlacedAt = new Date(),
  className = "",
  subscriptionId,
  deliveryTime
}: DeliveryTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    if (deliveryType !== 'immediate') return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const deliveryTime = new Date(orderPlacedAt.getTime() + 20 * 60 * 1000); // 20 minutes after order
      const difference = deliveryTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const minutes = Math.floor(difference / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ minutes, seconds, isExpired: false });
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [deliveryType, orderPlacedAt]);

  const formatTime = (num: number): string => {
    return num.toString().padStart(2, '0');
  };

  const getScheduledDeliveryInfo = () => {
    if (!scheduledTime) return null;
    
    const scheduledDate = new Date(scheduledTime);
    const now = new Date();
    const isToday = scheduledDate.toDateString() === now.toDateString();
    
    return {
      date: scheduledDate.toLocaleDateString('en-US', { 
        weekday: isToday ? undefined : 'long',
        month: 'short', 
        day: 'numeric' 
      }),
      time: scheduledDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
      isToday
    };
  };

  if (deliveryType === 'scheduled') {
    const scheduleInfo = getScheduledDeliveryInfo();
    
    // Different display for subscription vs regular scheduled orders
    const isSubscription = Boolean(subscriptionId);
    const displayTime = deliveryTime || scheduleInfo?.time;
    const title = isSubscription ? 'Subscription Delivery' : 'Scheduled Delivery';
    const subtitle = isSubscription ? 'Delivery at' : 'Arrives at';
    const badgeText = isSubscription ? 'Subscription' : 'Scheduled';
    
    return (
      <Card className={`bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 shadow-lg max-w-sm ${className}`}>
        <CardContent className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-blue-500/20 rounded-full">
                <Calendar className="w-3 h-3 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-xs">{title}</h3>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <Badge className="bg-blue-500 text-white animate-pulse text-xs px-2 py-0.5">
              {badgeText}
            </Badge>
          </div>
          
          <div className="mt-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="text-center">
              <p className="text-lg font-bold text-blue-400">{displayTime}</p>
              <p className="text-xs text-muted-foreground">
                {isSubscription ? 'Today' : (scheduleInfo?.isToday ? 'Today' : scheduleInfo?.date)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 shadow-lg max-w-sm ${className}`}>
      <CardContent className="p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-green-500/20 rounded-full">
              <Timer className="w-3 h-3 text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-xs">Delivery Timer</h3>
              <p className="text-xs text-muted-foreground">Arrives within</p>
            </div>
          </div>
          <Badge className={`${
            timeLeft.isExpired ? 'bg-red-500' : 'bg-green-500'
          } text-white animate-pulse text-xs px-2 py-0.5`}>
            {timeLeft.isExpired ? 'Overdue' : 'On Time'}
          </Badge>
        </div>
        
        <div className="mt-2 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <Clock className="w-4 h-4 text-green-400" />
              <div className={`text-lg font-bold ${
                timeLeft.isExpired ? 'text-red-400' : 'text-green-400'
              }`}>
                {timeLeft.isExpired ? '00:00' : `${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {timeLeft.isExpired ? 'Delivery window exceeded' : 'Minutes remaining'}
            </p>
          </div>
          
          {!timeLeft.isExpired && (
            <div className="mt-1">
              <div className="w-full bg-muted/20 rounded-full h-1">
                <div 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-1 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${Math.max(0, (timeLeft.minutes * 60 + timeLeft.seconds) / (20 * 60) * 100)}%` 
                  }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-1 text-center">
          <p className="text-xs text-muted-foreground">
            {timeLeft.isExpired 
              ? 'Please contact customer service if your order hasn\'t arrived'
              : 'Track your delivery agent in real-time'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryTimer;