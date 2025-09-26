import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Timer, Calendar } from "lucide-react";

interface DeliveryTimerProps {
  deliveryType: 'immediate' | 'scheduled' | 'book_now_pay_later';
  scheduledTime?: string; // For scheduled deliveries
  orderPlacedAt?: Date; // When the order was placed
  className?: string;
  subscriptionId?: string; // For subscription orders
  deliveryTime?: string; // Actual delivery time (formatted like "12:00 PM")
  deliverySlots?: {
    id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
  }; // For timing intervals
  paymentStatus?: string; // For book now pay later orders
}

const DeliveryTimer = ({ 
  deliveryType, 
  scheduledTime, 
  orderPlacedAt, // Remove default value here
  className = "",
  subscriptionId,
  deliveryTime,
  deliverySlots,
  paymentStatus
}: DeliveryTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    if (deliveryType !== 'immediate') return;
    
    // Use the actual order placed time from backend, fallback to current time
    const actualOrderTime = orderPlacedAt ? new Date(orderPlacedAt) : new Date();

    const calculateTimeLeft = () => {
      const now = new Date();
      const deliveryTime = new Date(actualOrderTime.getTime() + 20 * 60 * 1000); // 20 minutes after actual order time
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
    
    try {
      const scheduledDate = new Date(scheduledTime);
      
      // Check if the date is valid
      if (isNaN(scheduledDate.getTime())) {
        console.warn('Invalid scheduled time:', scheduledTime);
        return null;
      }
      
      // For scheduled orders, show the actual scheduled date, not relative to "today"
      const orderDate = orderPlacedAt ? new Date(orderPlacedAt) : new Date();
      const isOrderToday = scheduledDate.toDateString() === orderDate.toDateString();
      
      return {
        date: scheduledDate.toLocaleDateString('en-US', { 
          weekday: isOrderToday ? undefined : 'long',
          month: 'short', 
          day: 'numeric' 
        }),
        time: scheduledDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }),
        isOrderToday: isOrderToday,
        actualDate: scheduledDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: scheduledDate.getFullYear() !== orderDate.getFullYear() ? 'numeric' : undefined
        })
      };
    } catch (error) {
      console.warn('Error parsing scheduled time:', scheduledTime, error);
      return null;
    }
  };

  if (deliveryType === 'scheduled' || deliveryType === 'book_now_pay_later') {
    const scheduleInfo = getScheduledDeliveryInfo();
    
    // Different display for subscription vs book now pay later vs regular scheduled orders
    const isSubscription = Boolean(subscriptionId);
    const isBookNowPayLater = deliveryType === 'book_now_pay_later';
    
    console.log('DeliveryTimer Debug - Order data:', {
      deliverySlots,
      deliveryTime,
      scheduledTime,
      scheduleInfo,
      isSubscription,
      isBookNowPayLater,
      paymentStatus
    });
    
    // Determine display time - prioritize delivery slots for timing intervals
    let displayTime = null;
    let hasTimeSlot = false;
    
    if (deliverySlots && deliverySlots.start_time && deliverySlots.end_time) {
      // Format time slots as intervals with robust parsing
      const formatSlotTime = (timeStr: string) => {
        try {
          // Handle different time formats from backend
          let normalizedTime = timeStr.trim();
          
          // If time doesn't include seconds, add them
          if (normalizedTime.match(/^\d{1,2}:\d{2}$/)) {
            normalizedTime += ':00';
          }
          
          // Ensure proper HH:MM:SS format
          if (!normalizedTime.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
            console.warn('Invalid time format received:', timeStr);
            // Try to extract time components manually
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
              const hour = parseInt(timeMatch[1]);
              const minute = parseInt(timeMatch[2]);
              if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                return `${displayHour}:${timeMatch[2]} ${period}`;
              }
            }
            return timeStr; // Return original if manual parsing fails
          }
          
          // Create date object with proper ISO format
          const time = new Date(`1970-01-01T${normalizedTime}`);
          
          // Check if date is valid
          if (isNaN(time.getTime())) {
            console.warn('Failed to parse time as Date:', normalizedTime);
            // Manual fallback parsing
            const parts = normalizedTime.split(':');
            if (parts.length >= 2) {
              const hour = parseInt(parts[0]);
              const minute = parseInt(parts[1]);
              if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
              }
            }
            return timeStr;
          }
          
          return time.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          });
        } catch (error) {
          console.warn('Error formatting slot time:', timeStr, error);
          // Final fallback - manual parsing
          const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
          if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);
            if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
              const period = hour >= 12 ? 'PM' : 'AM';
              const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
              return `${displayHour}:${timeMatch[2]} ${period}`;
            }
          }
          return timeStr;
        }
      };
      displayTime = `${formatSlotTime(deliverySlots.start_time)} - ${formatSlotTime(deliverySlots.end_time)}`;
      hasTimeSlot = true;
      console.log('Using delivery slots for time display:', displayTime);
    } else if (deliveryTime && !deliveryTime.includes('min') && !deliveryTime.includes('Time to be confirmed')) {
      // Use deliveryTime only if it's not a duration (like "2 min") or confirmation message
      displayTime = deliveryTime;
      console.log('Using deliveryTime for display:', displayTime);
    } else if (scheduleInfo?.time) {
      displayTime = scheduleInfo.time;
      console.log('Using scheduleInfo time for display:', displayTime);
    } else {
      // For scheduled orders, show default time slots if backend data is incomplete
      displayTime = isSubscription ? '6:00 AM - 10:00 AM' : (isBookNowPayLater ? '6:00 AM - 10:00 AM' : '6:00 AM - 10:00 AM');
      hasTimeSlot = true;
      console.warn('Using fallback time slot for order');
    }
    
    const title = isSubscription ? 'Subscription Delivery' : (isBookNowPayLater ? 'Book Now Pay Later' : 'Scheduled Delivery');
    const subtitle = hasTimeSlot ? 'Delivery window' : (isSubscription ? 'Delivery at' : (isBookNowPayLater ? 'Available at' : 'Arrives at'));
    const badgeText = isSubscription ? 'Subscription' : (isBookNowPayLater ? 'Pay Later' : 'Scheduled');
    
    // Different color schemes for different order types
    const gradientClass = isBookNowPayLater 
      ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30'
      : isSubscription 
        ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30'
        : 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30';
    
    const iconClass = isBookNowPayLater 
      ? 'bg-orange-500/20'
      : isSubscription 
        ? 'bg-purple-500/20'
        : 'bg-blue-500/20';
    
    const iconColor = isBookNowPayLater 
      ? 'text-orange-400'
      : isSubscription 
        ? 'text-purple-400'
        : 'text-blue-400';
    
    const badgeColor = isBookNowPayLater 
      ? 'bg-orange-500'
      : isSubscription 
        ? 'bg-purple-500'
        : 'bg-blue-500';

    return (
      <Card className={`${gradientClass} shadow-lg max-w-sm ${className}`}>
        <CardContent className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`p-1 ${iconClass} rounded-full`}>
                <Calendar className={`w-3 h-3 ${iconColor}`} />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-xs">{title}</h3>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <Badge className={`${badgeColor} text-white animate-pulse text-xs px-2 py-0.5`}>
              {badgeText}
            </Badge>
          </div>
          
          <div className={`mt-2 p-2 ${isBookNowPayLater ? 'bg-orange-500/10 border border-orange-500/20' : isSubscription ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-blue-500/10 border border-blue-500/20'} rounded-lg`}>
            <div className="text-center">
              <p className={`text-lg font-bold ${isBookNowPayLater ? 'text-orange-400' : isSubscription ? 'text-purple-400' : 'text-blue-400'}`}>
                {displayTime || 'Time TBD'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasTimeSlot ? 
                  'Delivery Window' : 
                  (isSubscription ? scheduleInfo?.actualDate || 'Today' : (isBookNowPayLater ? 'Pay to confirm delivery' : (scheduleInfo?.isOrderToday ? 'Today' : scheduleInfo?.actualDate || scheduleInfo?.date || 'Date TBD')))
                }
              </p>
            </div>
            {hasTimeSlot && (
              <div className="mt-1 text-center">
                <Badge variant="outline" className={`text-xs ${isBookNowPayLater ? 'bg-orange-500/20 text-orange-700 border-orange-500/30' : isSubscription ? 'bg-purple-500/20 text-purple-700 border-purple-500/30' : 'bg-blue-500/20 text-blue-700 border-blue-500/30'}`}>
                  Time Slot
                </Badge>
              </div>
            )}
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