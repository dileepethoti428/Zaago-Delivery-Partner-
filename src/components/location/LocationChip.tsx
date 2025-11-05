import { motion } from 'framer-motion';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { useLocationStore } from '@/store/location';
import { formatCoords } from '@/utils/geo';
import { toast } from '@/hooks/use-toast';

export default function LocationChip() {
  const { permission, lastKnown, label, isWatching, error } = useLocationStore();

  const handleClick = () => {
    if (permission === 'denied') {
      toast({
        title: 'Location Permission Denied',
        description: 'Please enable location access in your browser settings.',
        variant: 'destructive',
      });
    } else if (permission === 'unsupported') {
      toast({
        title: 'Location Not Supported',
        description: 'Your browser does not support geolocation.',
        variant: 'destructive',
      });
    }
  };

  const getStatusDot = () => {
    if (permission === 'denied') return <StatusDot status="error" />;
    if (permission === 'unsupported') return <StatusDot status="inactive" />;
    if (isWatching) return <StatusDot status="active" pulse />;
    return <StatusDot status="warning" />;
  };

  const getText = () => {
    // No location yet and still detecting
    if (!lastKnown && permission === 'prompt') {
      return 'Detecting location...';
    }

    // Permission denied
    if (permission === 'denied') {
      return 'Location denied';
    }

    // Unsupported
    if (permission === 'unsupported') {
      return 'Location unavailable';
    }

    // Has location
    if (lastKnown) {
      // Show label if available
      if (label) {
        return label.length > 30 ? label.substring(0, 27) + '...' : label;
      }
      
      // Show coordinates with accuracy
      const coords = formatCoords({ lat: lastKnown.lat, lng: lastKnown.lng });
      const accuracy = lastKnown.accuracy ? ` (±${Math.round(lastKnown.accuracy)}m)` : '';
      return `${coords}${accuracy}`;
    }

    return 'Location unknown';
  };

  const getIcon = () => {
    if (!lastKnown && permission === 'prompt') {
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    }
    if (permission === 'denied' || permission === 'unsupported') {
      return <AlertCircle className="h-3.5 w-3.5" />;
    }
    return <MapPin className="h-3.5 w-3.5" />;
  };

  const getVariant = () => {
    if (permission === 'denied') return 'destructive';
    if (permission === 'unsupported') return 'secondary';
    return 'default';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Badge
        variant={getVariant()}
        className="gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={handleClick}
      >
        {getStatusDot()}
        {getIcon()}
        <span className="text-xs font-medium">{getText()}</span>
      </Badge>
    </motion.div>
  );
}
