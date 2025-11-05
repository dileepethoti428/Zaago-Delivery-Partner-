import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface DistanceBadgeProps {
  distance: number;
}

export function DistanceBadge({ distance }: DistanceBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <MapPin className="h-3 w-3" />
      {distance} km
    </Badge>
  );
}
