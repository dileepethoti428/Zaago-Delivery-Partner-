import { useState, useMemo } from 'react';
import { Package, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import type { AssignedOrder } from '@/services/assignedOrders';

interface PickupSummaryCardProps {
  orders: AssignedOrder[];
  label?: string;
}

interface SellerPickup {
  sellerName: string;
  products: Record<string, number>;
  totalItems: number;
}

export function PickupSummaryCard({ orders, label = 'Today' }: PickupSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  const { sellers, vacationCount, totalItems } = useMemo(() => {
    const activeOrders = orders.filter(o => !o.isOnVacation);
    const vacationCount = orders.length - activeOrders.length;

    const sellerMap: Record<string, SellerPickup> = {};

    for (const order of activeOrders) {
      const key = order.sellerName || 'Unknown Seller';

      if (!sellerMap[key]) {
        sellerMap[key] = { sellerName: key, products: {}, totalItems: 0 };
      }

      const productKey = order.productUnit
        ? `${order.productName || 'Unknown Product'} (${order.productUnit})`
        : (order.productName || 'Unknown Product');
      sellerMap[key].products[productKey] = (sellerMap[key].products[productKey] || 0) + order.quantity;
      sellerMap[key].totalItems += order.quantity;
    }

    const sellers = Object.values(sellerMap).sort((a, b) => b.totalItems - a.totalItems);
    const totalItems = sellers.reduce((sum, s) => sum + s.totalItems, 0);

    return { sellers, vacationCount, totalItems };
  }, [orders]);

  if (orders.length === 0 || sellers.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  Pickup Summary ({label})
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {totalItems} items
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {sellers.map((seller) => (
              <SellerSection key={seller.sellerName} seller={seller} />
            ))}

            {vacationCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 pt-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Excluding {vacationCount} vacation order{vacationCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function SellerSection({ seller }: { seller: SellerPickup }) {
  const [open, setOpen] = useState(true);
  const products = Object.entries(seller.products).sort((a, b) => b[1] - a[1]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors">
        <span>{seller.sellerName} ({seller.totalItems} items)</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="pl-4 space-y-1 pb-1">
          {products.map(([name, qty]) => (
            <li key={name} className="flex items-center justify-between text-sm text-muted-foreground">
              <span>• {name}</span>
              <span className="font-semibold text-foreground tabular-nums">{qty}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
