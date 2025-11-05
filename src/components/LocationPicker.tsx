import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, Search, Crosshair, ChevronRight } from "lucide-react";
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
    <Sheet open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </div>
      
      <SheetContent 
        side="bottom" 
        className="h-[85vh] p-0 rounded-t-3xl border-t-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-border/50">
          <SheetTitle className="text-xl font-bold text-left">Select Location</SheetTitle>
          <SheetDescription className="text-left text-sm">
            Search or use your current location
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Use Current Location Button - Blinkit Style */}
          <button
            onClick={handleUseCurrentLocation}
            disabled={isGettingLocation}
            className="w-full p-4 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 border border-primary/20 rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary rounded-lg flex-shrink-0">
                <Crosshair className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <div className="font-semibold text-base text-foreground">
                  {isGettingLocation ? "Getting location..." : "Use Current Location"}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                  {location.loading 
                    ? "Detecting..." 
                    : location.address 
                      ? location.address 
                      : "Enable GPS for instant delivery"
                  }
                </div>
              </div>
              {!isGettingLocation && (
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          </button>

          {/* Search Box - Blinkit Style */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search for area, street name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
                className="pl-12 pr-4 h-14 text-base border-2 border-border/50 rounded-xl focus:border-primary transition-colors"
              />
            </div>
            
            {/* Search Results */}
            {predictions.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Search Results
                </div>
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {predictions.map((prediction) => (
                    <button
                      key={prediction.place_id}
                      onClick={() => selectPlace(prediction)}
                      disabled={isGettingLocation}
                      className="w-full p-4 text-left hover:bg-secondary/50 rounded-xl transition-all duration-150 border border-transparent hover:border-border/30 active:scale-[0.98] disabled:opacity-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-secondary rounded-lg flex-shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-base text-foreground line-clamp-1">
                            {prediction.main_text}
                          </div>
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {prediction.secondary_text}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {isSearching && (
              <div className="mt-3 p-8 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Searching nearby...</span>
                </div>
              </div>
            )}

            {/* Empty State */}
            {searchQuery && !isSearching && predictions.length === 0 && (
              <div className="mt-8 text-center px-4 py-8">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-base font-medium text-foreground mb-2">
                  No locations found
                </div>
                <div className="text-sm text-muted-foreground">
                  Try searching with different keywords
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};