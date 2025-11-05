import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Search } from "lucide-react";
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
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </div>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Location</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Button
            onClick={handleUseCurrentLocation}
            disabled={isGettingLocation}
            className="w-full"
            variant="outline"
          >
            <Navigation className="w-4 h-4 mr-2" />
            {isGettingLocation ? "Getting location..." : "Use Current Location"}
          </Button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              className="pl-9"
            />
          </div>
          
          {predictions.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {predictions.map((prediction) => (
                <button
                  key={prediction.place_id}
                  onClick={() => selectPlace(prediction)}
                  disabled={isGettingLocation}
                  className="w-full p-3 text-left hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{prediction.main_text}</div>
                      <div className="text-xs text-muted-foreground">{prediction.secondary_text}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {isSearching && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Searching...</span>
              </div>
            </div>
          )}

          {searchQuery && !isSearching && predictions.length === 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No locations found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};