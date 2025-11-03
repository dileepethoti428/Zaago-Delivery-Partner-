import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Timer, Calendar } from "lucide-react";
import { formatTimeSlot } from "@/lib/deliverySlotParser";

interface DeliveryTimerProps {
  deliveryType: 'immediate' | 'scheduled' | 'book_now_pay_later' | 'subscription';
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
  deliveryTimeSlot?: string; // Backend provided time slot (e.g., "06:00-10:00")
  immediateTimingConfig?: {
    max_duration_minutes: number;
    time_slot_start: string;
    time_slot_end: string;
    slot_name: string;
  };
  acceptedAt?: Date; // When the agent accepted the order
  scheduledTimingConfig?: {
    max_duration_minutes: number; // Duration for scheduled orders after acceptance
  };
}

const DeliveryTimer = ({ 
  deliveryType, 
  scheduledTime, 
  orderPlacedAt,
  className = "",
  subscriptionId,
  deliveryTime,
  deliverySlots,
  paymentStatus,
  deliveryTimeSlot,
  immediateTimingConfig,
  acceptedAt,
  scheduledTimingConfig
}: DeliveryTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ minutes: 0, seconds: 0, isExpired: false });

  useEffect(() => {
    // Only show countdown timer for immediate deliveries
    if (deliveryType !== 'immediate') return;
    
    // Use the actual order placed time from backend - this is critical for proper sync
    if (!orderPlacedAt) {
      console.warn('⚠️ No orderPlacedAt provided for immediate delivery timer');
      return;
    }
    
    let isMounted = true;
    const actualOrderTime = new Date(orderPlacedAt);
    console.log('🕐 Setting up immediate delivery timer for order placed at:', actualOrderTime);

    const calculateTimeLeft = () => {
      if (!isMounted) return;
      
      const now = new Date();
      
      // Use timing from backend configuration, fallback to 20 minutes
      const durationMinutes = immediateTimingConfig?.max_duration_minutes || 20;
      const deliveryTime = new Date(actualOrderTime.getTime() + durationMinutes * 60 * 1000);
      const difference = deliveryTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, isExpired: true });
        console.log('✅ Timer expired - delivery overdue');
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

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [deliveryType, orderPlacedAt, immediateTimingConfig]);

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

  if (deliveryType === 'scheduled' || deliveryType === 'book_now_pay_later' || deliveryType === 'subscription') {
    const scheduleInfo = getScheduledDeliveryInfo();
    
    // Different display for subscription vs book now pay later vs regular scheduled orders
    const isSubscription = deliveryType === 'subscription' || Boolean(subscriptionId);
    const isBookNowPayLater = deliveryType === 'book_now_pay_later';
    const isScheduled = deliveryType === 'scheduled';
    
    console.log('DeliveryTimer Debug - Order data:', {
      deliveryType,
      deliveryTimeSlot,
      deliverySlots,
      deliveryTime,
      scheduledTime,
      scheduleInfo,
      isSubscription,
      isBookNowPayLater,
      isScheduled,
      paymentStatus
    });
    
    // Determine display time - prioritize backend deliveryTimeSlot
    let displayTime = null;
    let hasTimeSlot = false;
    
    // First priority: Backend provided deliveryTimeSlot (e.g., "06:00-10:00")
    if (deliveryTimeSlot && deliveryTimeSlot.includes('-')) {
      const [startTime, endTime] = deliveryTimeSlot.split('-');
      const startFormatted = formatTimeSlot(startTime);
      const endFormatted = formatTimeSlot(endTime);
      
      if (startFormatted && endFormatted) {
        displayTime = `${startFormatted} - ${endFormatted}`;
        hasTimeSlot = true;
        console.log('✅ Using backend deliveryTimeSlot:', displayTime);
      }
    }
    
    // Second priority: Frontend delivery slots for time ranges
    if (!displayTime && deliverySlots && deliverySlots.start_time && deliverySlots.end_time) {
      const startFormatted = formatTimeSlot(deliverySlots.start_time);
      const endFormatted = formatTimeSlot(deliverySlots.end_time);
      
      if (startFormatted && endFormatted) {
        // For subscription orders, always show time range (even if times are same)
        if (isSubscription) {
          displayTime = `${startFormatted} - ${endFormatted}`;
          hasTimeSlot = true;
          console.log('✅ Using subscription delivery slots:', displayTime);
        } 
        // For other orders, only show range if times are different
        else if (startFormatted !== endFormatted) {
          displayTime = `${startFormatted} - ${endFormatted}`;
          hasTimeSlot = true;
          console.log('✅ Using scheduled delivery slots:', displayTime);
        }
      }
    }
    
    // Fallback to other time sources if slots are not available or invalid
    if (!displayTime) {
      if (deliveryTime && !deliveryTime.includes('min') && !deliveryTime.includes('Time to be confirmed') && !deliveryTime.includes('TBD') && deliveryTime !== '12:00:00') {
        // Use deliveryTime if it's not a generic default or confirmation message
        const formattedTime = formatTimeSlot(deliveryTime);
        if (formattedTime) {
          displayTime = formattedTime;
          console.log('Using deliveryTime for display:', displayTime);
        }
      } else if (scheduleInfo?.time) {
        displayTime = scheduleInfo.time;
        console.log('Using scheduleInfo time for display:', displayTime);
      } else {
        // Specific fallbacks based on actual order type and data
        if (isSubscription) {
          displayTime = '6:00 AM - 10:00 AM';
          hasTimeSlot = true;
          console.log('Using subscription morning delivery slot fallback');
        } else if (isBookNowPayLater) {
          displayTime = 'Schedule on payment'; 
          hasTimeSlot = false;
          console.log('Using book now pay later message');
        } else {
          // For other scheduled orders without specific time data
          displayTime = 'Time will be confirmed';
          hasTimeSlot = false;
          console.warn('Scheduled order without specific time data');
        }
      }
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

  // Show immediate delivery countdown timer
  if (deliveryType === 'immediate') {
    console.log('🚀 Rendering immediate delivery timer - Time left:', timeLeft);
    
    return (
      <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 shadow-lg max-w-sm">
        <CardContent className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-green-500/20 rounded-full">
                <Clock className="w-3 h-3 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-xs">Immediate Delivery</h3>
                <p className="text-xs text-muted-foreground">
                  {timeLeft.isExpired ? 'Overdue' : 'Time remaining'}
                </p>
              </div>
            </div>
            <Badge className="bg-green-500 text-white animate-pulse text-xs px-2 py-0.5">
              {timeLeft.isExpired ? 'Overdue' : 'Live'}
            </Badge>
          </div>
          
          <div className="mt-2 text-center">
            <div className={`text-lg font-mono font-bold ${timeLeft.isExpired ? 'text-red-500' : 'text-green-600'}`}>
              {timeLeft.isExpired ? '00:00' : `${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {timeLeft.isExpired ? 'Delivery overdue' : 'Minutes remaining'}
            </div>
            
            {/* Progress bar */}
            {!timeLeft.isExpired && (
              <div className="w-full bg-green-100 rounded-full h-1 mt-2">
                <div 
                  className="bg-green-500 h-1 rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${Math.max(0, ((timeLeft.minutes * 60 + timeLeft.seconds) / (20 * 60)) * 100)}%` 
                  }}
                />
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