import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface DistanceBadgeProps {
  distance?: number;
  radiusKm?: number;
}

export function DistanceBadge({ distance, radiusKm }: DistanceBadgeProps) {
  // Show radius filter badge
  if (radiusKm !== undefined) {
    return (
      <Badge className="gap-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-medium">
        <MapPin className="h-3 w-3" />
        ≤ {radiusKm} km
      </Badge>
    );
  }

  // Show specific distance
  if (distance !== undefined) {
    return (
      <Badge variant="secondary" className="gap-1 font-medium">
        <MapPin className="h-3 w-3" />
        {distance} km
      </Badge>
    );
  }

  return null;
}
