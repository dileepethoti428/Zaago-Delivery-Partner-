import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Map, Search } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface LocationPickerProps {
  children: React.ReactNode;
  onLocationSelected?: (location: { lat: number; lng: number; address: string }) => void;
}

interface Prediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
  types: string[];
}

export const LocationPicker = ({ children, onLocationSelected }: LocationPickerProps) => {
  const [open, setOpen] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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

  // Google Places search functionality
  const searchPlaces = async (input: string) => {
    if (!input.trim()) {
      setPredictions([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          input: input.trim(),
          location: location.latitude && location.longitude ? {
            lat: location.latitude,
            lng: location.longitude
          } : null,
          types: "geocode"
        }
      });

      if (error) throw error;

      if (data.success) {
        setPredictions(data.predictions || []);
      } else {
        throw new Error(data.error || 'Failed to search places');
      }
    } catch (error) {
      console.error('Places search error:', error);
      toast({
        title: "Search Error",
        description: "Failed to search places. Please try again.",
        variant: "destructive",
      });
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const selectPlace = async (prediction: Prediction) => {
    try {
      setIsGettingLocation(true);
      
      const { data, error } = await supabase.functions.invoke('google-places-geocode', {
        body: {
          placeId: prediction.place_id
        }
      });

      if (error) throw error;

      if (data.success) {
        const selectedLocation = {
          lat: data.coordinates.lat,
          lng: data.coordinates.lng,
          address: data.address
        };

        onLocationSelected?.(selectedLocation);
        setOpen(false);
        setSearchQuery("");
        setPredictions([]);

        toast({
          title: "Location Selected",
          description: `Selected: ${data.address}`,
        });
      } else {
        throw new Error(data.error || 'Failed to get place details');
      }
    } catch (error) {
      console.error('Place selection error:', error);
      toast({
        title: "Selection Error",
        description: "Failed to select location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-md mx-4">
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
            className="w-full justify-start h-auto p-3 sm:p-4"
            variant="outline"
          >
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <div className="font-medium text-sm sm:text-base">Use Current Location</div>
                <div className="text-xs sm:text-sm text-muted-foreground truncate">
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

          <div className="relative">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search for places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
                className="flex-1 text-sm"
              />
            </div>
            
            {predictions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
                {predictions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    onClick={() => selectPlace(prediction)}
                    disabled={isGettingLocation}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {prediction.main_text}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {prediction.secondary_text}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {isSearching && (
              <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg p-4">
                <div className="text-sm text-muted-foreground">Searching...</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};