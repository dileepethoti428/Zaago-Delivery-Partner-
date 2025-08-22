import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Navigation, 
  MapPin, 
  Timer,
  Phone,
  ExternalLink
} from "lucide-react";

interface NavigationMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerLocation: { lat: number; lng: number };
  customerAddress: string;
  customerName: string;
  customerPhone?: string;
}

export const NavigationMap = ({ 
  open, 
  onOpenChange, 
  customerLocation, 
  customerAddress, 
  customerName,
  customerPhone 
}: NavigationMapProps) => {
  const { toast } = useToast();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<string>('');
  const [eta, setEta] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      getCurrentLocation();
    }
  }, [open]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(location);
          calculateRouteDetails(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: "Location Error",
            description: "Unable to get your current location",
            variant: "destructive"
          });
          setIsLoading(false);
        }
      );
    } else {
      toast({
        title: "Location Not Supported",
        description: "Geolocation is not supported by this browser",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const calculateRouteDetails = (origin: { lat: number; lng: number }) => {
    // Calculate straight-line distance
    const R = 6371; // Earth's radius in km
    const dLat = (customerLocation.lat - origin.lat) * Math.PI / 180;
    const dLon = (customerLocation.lng - origin.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(origin.lat * Math.PI / 180) * Math.cos(customerLocation.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;

    setDistance(`${dist.toFixed(1)} km`);
    setEta(`${Math.ceil(dist * 3)} mins`); // Rough estimate: 3 mins per km
    setIsLoading(false);
  };

  const openInGoogleMaps = () => {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${customerLocation.lat},${customerLocation.lng}&travelmode=driving`;
    window.open(googleMapsUrl, '_blank');
  };

  const openInAppleMaps = () => {
    const appleMapsUrl = `http://maps.apple.com/?daddr=${customerLocation.lat},${customerLocation.lng}`;
    window.open(appleMapsUrl, '_blank');
  };

  const callCustomer = () => {
    if (customerPhone) {
      window.open(`tel:${customerPhone}`, '_self');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => onOpenChange(false)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Navigate to Customer</h1>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </div>
        <Navigation className="w-6 h-6 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Customer Info Card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-base">
              <MapPin className="w-5 h-5 text-primary" />
              <span>Destination</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-medium text-foreground">{customerName}</p>
              <p className="text-sm text-muted-foreground">{customerAddress}</p>
            </div>
            
            {!isLoading && (
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>{distance}</span>
                </Badge>
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Timer className="w-3 h-3" />
                  <span>~{eta}</span>
                </Badge>
              </div>
            )}

            {customerPhone && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={callCustomer}
                className="flex items-center space-x-2"
              >
                <Phone className="w-4 h-4" />
                <span>Call Customer</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Map Placeholder */}
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Navigation className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Navigation Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred navigation app
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Location */}
        {currentLocation && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">Your Location:</span>
                <span className="text-foreground">
                  {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 bg-card border-t border-border space-y-3">
        <Button 
          onClick={openInGoogleMaps}
          className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in Google Maps
        </Button>
        
        <Button 
          variant="outline" 
          onClick={openInAppleMaps}
          className="w-full border-border"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open in Apple Maps
        </Button>
      </div>
    </div>
  );
};