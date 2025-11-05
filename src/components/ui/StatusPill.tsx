import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: 'new' | 'open' | 'accepted' | 'picked' | 'picked_up' | 'delivered' | 'canceled' | 'cancelled' | string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  open: { label: 'Open', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  picked: { label: 'Picked Up', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  picked_up: { label: 'Picked Up', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  delivered: { label: 'Delivered', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  canceled: { label: 'Canceled', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
};

export function StatusPill({ status }: StatusPillProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' };
  return (
    <Badge className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
