import { useState, memo, useMemo } from 'react';
import { AnimatedCard } from '@/components/ui/AnimatedCard';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { 
  Package, MapPin, Clock, Star, IndianRupee, 
  Phone, ChevronDown, Wallet, FileText, Image as ImageIcon,
  ShoppingBag
} from 'lucide-react';
import { formatDeliveryDate, formatDeliveryTime, type DeliveryHistoryItem } from '@/services/deliveryHistory';
import { formatDeliveryAddress, formatPhoneNumber, parseDeliveryItems } from '@/utils/deliveryHelpers';
import { callPhone } from '@/utils/phone';
import { useNavigate } from 'react-router-dom';

interface DeliveryHistoryCardProps {
  delivery: DeliveryHistoryItem;
  index: number;
}

export const DeliveryHistoryCard = memo(function DeliveryHistoryCard({ 
  delivery, 
  index 
}: DeliveryHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const addressString = useMemo(
    () => formatDeliveryAddress(delivery.delivery_address),
    [delivery.delivery_address]
  );
  
  const items = useMemo(
    () => parseDeliveryItems(delivery.items),
    [delivery.items]
  );
  
  const formattedPhone = useMemo(
    () => formatPhoneNumber(delivery.customer_phone),
    [delivery.customer_phone]
  );

  return (
    <AnimatedCard
      key={delivery.id}
      delay={index * 0.05}
      onClick={() => !isExpanded && navigate(`/order/${delivery.order_id}`)}
    >
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="space-y-3">
            {/* Header - Always Visible */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm text-muted-foreground">
                    #{delivery.order_id.slice(0, 8)}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">
                  {delivery.customer_name || 'Customer'}
                </h3>
                {formattedPhone && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); callPhone(delivery.customer_phone); }}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {formattedPhone}
                  </button>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusPill status="delivered" />
                <CollapsibleTrigger 
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs">{isExpanded ? 'Less' : 'More'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
              </div>
            </div>

            {/* Summary Info - Always Visible */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDeliveryDate(delivery.completed_at)}</span>
              </div>
              <span>•</span>
              <span>{formatDeliveryTime(delivery.completed_at)}</span>
            </div>

            {/* Quick Summary - Always Visible */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-3">
                {items.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <ShoppingBag className="h-4 w-4" />
                    <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
                  </div>
                )}
                {delivery.distance_traveled && (
                  <DistanceBadge distance={delivery.distance_traveled} />
                )}
              </div>
              <div className="flex items-center gap-1 font-semibold text-lg text-primary">
                <IndianRupee className="h-4 w-4" />
                {delivery.delivery_payout?.toFixed(0) || '0'}
              </div>
            </div>

            {/* Expanded Content */}
            <CollapsibleContent className="space-y-4 pt-2">
              <Separator />

              {/* Delivery Address Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>DELIVERY ADDRESS</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {addressString}
                </p>
              </div>

              {/* Items Section */}
              {items.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShoppingBag className="h-4 w-4 text-primary" />
                      <span>ITEMS DELIVERED ({items.length})</span>
                    </div>
                    <div className="space-y-2 pl-6">
                      {items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-start justify-between text-sm">
                          <div className="flex-1">
                            <p className="font-medium">{item.name || item.product_name || 'Item'}</p>
                            {item.type && (
                              <p className="text-xs text-muted-foreground">{item.type}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              <span>{item.quantity || 1} {item.unit || 'unit'}</span>
                              {item.price && (
                                <>
                                  <span>×</span>
                                  <span>₹{item.price}</span>
                                  <span>=</span>
                                  <span className="font-medium">₹{(item.quantity || 1) * item.price}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Payment Information */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span>PAYMENT</span>
                </div>
                <div className="space-y-1.5 pl-6 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Method:</span>
                    <Badge variant={delivery.payment_method?.toUpperCase() === 'COD' ? 'secondary' : 'default'}>
                      {delivery.payment_method?.toUpperCase() || 'COD'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={delivery.payment_status === 'paid' ? 'default' : 'outline'}>
                      {delivery.payment_status === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                  {delivery.total_amount !== null && (
                    <div className="flex items-center justify-between font-semibold pt-1">
                      <span>Total Amount:</span>
                      <span className="text-primary">₹{delivery.total_amount.toFixed(0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Information */}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-primary" />
                  <span>DELIVERY INFO</span>
                </div>
                <div className="space-y-1.5 pl-6 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payout:</span>
                    <span className="font-semibold text-primary">₹{delivery.delivery_payout?.toFixed(0) || '0'}</span>
                  </div>
                  {delivery.delivery_duration && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{Math.round(delivery.delivery_duration)} min</span>
                    </div>
                  )}
                  {delivery.distance_traveled && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Distance:</span>
                      <span>{delivery.distance_traveled.toFixed(2)} km</span>
                    </div>
                  )}
                  {delivery.customer_rating && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rating:</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{delivery.customer_rating.toFixed(1)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span>{formatDeliveryDate(delivery.completed_at)} • {formatDeliveryTime(delivery.completed_at)}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Notes */}
              {delivery.delivery_notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-primary" />
                      <span>DELIVERY NOTES</span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      {delivery.delivery_notes}
                    </p>
                  </div>
                </>
              )}

              {/* Delivery Proof */}
              {delivery.delivery_proof && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span>DELIVERY PROOF</span>
                    </div>
                    <div className="pl-6">
                      {Array.isArray(delivery.delivery_proof) ? (
                        <div className="grid grid-cols-2 gap-2">
                          {delivery.delivery_proof.map((proof: any, idx: number) => (
                            <img 
                              key={idx}
                              src={proof.url || proof}
                              alt={`Delivery proof ${idx + 1}`}
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Proof uploaded</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>
      </CardContent>
    </AnimatedCard>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.delivery.id === nextProps.delivery.id &&
    prevProps.delivery.payment_status === nextProps.delivery.payment_status &&
    prevProps.index === nextProps.index
  );
});

