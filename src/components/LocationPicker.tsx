import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Navigation, Map } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";

interface LocationPickerProps {
  children: React.ReactNode;
  onLocationSelected?: (location: { lat: number; lng: number; address: string }) => void;
}

export const LocationPicker = ({ children, onLocationSelected }: LocationPickerProps) => {
  const [open, setOpen] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();

  const location = useGeolocation({
    enableHighAccuracy: true,
    saveToBackend: false, // Don't auto-save when just picking location
    refreshInterval: 0, // Don't auto-refresh for picker
  });

  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    
    try {
      // Force refresh location
      await location.refresh();
      
      if (location.latitude && location.longitude) {
        const selectedLocation = {
          lat: location.latitude,
          lng: location.longitude,
          address: location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
        };
        
        onLocationSelected?.(selectedLocation);
        setOpen(false);
        
        toast({
          title: "Location Selected",
          description: "Current location has been set successfully",
        });
      } else {
        throw new Error("Could not get current location");
      }
    } catch (error) {
      toast({
        title: "Location Error",
        description: "Failed to get current location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSelectOnMap = () => {
    // For now, show a message that this feature is coming soon
    toast({
      title: "Coming Soon",
      description: "Map selection feature will be available soon. Please use current location for now.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Location</DialogTitle>
          <DialogDescription>
            Choose how you want to set your location
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Button
            onClick={handleUseCurrentLocation}
            disabled={isGettingLocation}
            className="w-full justify-start h-auto p-4"
            variant="outline"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Navigation className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-medium">Use Current Location</div>
                <div className="text-sm text-muted-foreground">
                  {location.loading 
                    ? "Getting location..." 
                    : location.address 
                      ? location.address 
                      : "Detect your current position"
                  }
                </div>
              </div>
            </div>
          </Button>

          <Button
            onClick={handleSelectOnMap}
            className="w-full justify-start h-auto p-4"
            variant="outline"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-secondary/50 rounded-lg">
                <Map className="w-5 h-5 text-foreground" />
              </div>
              <div className="text-left">
                <div className="font-medium">Select on Map</div>
                <div className="text-sm text-muted-foreground">
                  Choose location manually on map
                </div>
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};