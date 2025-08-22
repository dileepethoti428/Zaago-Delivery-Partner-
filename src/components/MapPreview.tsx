import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Navigation, Maximize2 } from 'lucide-react';

interface MapPreviewProps {
  customerAddress: string;
  agentLocation?: [number, number];
  customerLocation?: [number, number];
  onFullScreenOpen?: () => void;
  className?: string;
}

const MapPreview: React.FC<MapPreviewProps> = ({
  customerAddress,
  agentLocation = [75.5625, 31.3260], // Default: Phagwara, Punjab
  customerLocation = [75.5726, 31.3346], // Default: Near Phagwara
  onFullScreenOpen,
  className = ""
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const initializeMap = (token: string) => {
    if (!mapContainer.current || !token) return;

    setIsLoading(true);
    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11', // Dark theme to match our app
        center: agentLocation,
        zoom: 13,
        pitch: 45,
        bearing: 0,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.on('load', () => {
        if (!map.current) return;

        // Add agent marker (current location)
        new mapboxgl.Marker({
          color: '#00FFAA', // Neon green for agent
          scale: 1.2,
        })
        .setLngLat(agentLocation)
        .setPopup(new mapboxgl.Popup().setHTML('<div class="text-sm font-medium">Your Location</div>'))
        .addTo(map.current);

        // Add customer marker
        new mapboxgl.Marker({
          color: '#FF4D6D', // Neon red for customer
          scale: 1.0,
        })
        .setLngLat(customerLocation)
        .setPopup(new mapboxgl.Popup().setHTML(`<div class="text-sm font-medium">Customer Location</div><div class="text-xs text-gray-600">${customerAddress}</div>`))
        .addTo(map.current);

        // Add route line
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [agentLocation, customerLocation]
            }
          }
        });

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#00FFAA',
            'line-width': 4,
            'line-opacity': 0.8
          }
        });

        // Fit bounds to show both markers
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(agentLocation);
        bounds.extend(customerLocation);
        
        map.current.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15
        });

        setIsLoading(false);
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setIsLoading(false);
        setShowTokenInput(true);
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
      setIsLoading(false);
      setShowTokenInput(true);
    }
  };

  const handleTokenSubmit = () => {
    if (mapboxToken.trim()) {
      setShowTokenInput(false);
      initializeMap(mapboxToken.trim());
    }
  };

  useEffect(() => {
    return () => {
      map.current?.remove();
    };
  }, []);

  if (showTokenInput) {
    return (
      <Card className={`bg-card border-border ${className}`}>
        <CardContent className="p-4">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mx-auto">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Map Preview</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your Mapbox public token to view the delivery route
              </p>
              <div className="space-y-3">
                <Input
                  placeholder="pk.eyJ1Ijoi... (Mapbox Public Token)"
                  value={mapboxToken}
                  onChange={(e) => setMapboxToken(e.target.value)}
                  className="bg-input border-border focus:border-primary"
                />
                <Button
                  onClick={handleTokenSubmit}
                  disabled={!mapboxToken.trim()}
                  className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
                >
                  Load Map
                </Button>
                <p className="text-xs text-muted-foreground">
                  Get your token at{' '}
                  <a 
                    href="https://mapbox.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    mapbox.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapContainer} 
        className="w-full h-64 rounded-lg border border-border relative overflow-hidden"
      />
      
      {isLoading && (
        <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Map overlay info */}
          <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm rounded-lg p-2 border border-border">
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span className="text-foreground font-medium">You</span>
              <div className="w-2 h-2 bg-destructive rounded-full ml-2" />
              <span className="text-foreground font-medium">Customer</span>
            </div>
          </div>

          {/* Full screen button */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm border border-border hover:bg-primary/10"
            onClick={onFullScreenOpen}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          {/* Route info */}
          <div className="absolute bottom-3 left-3 right-3 bg-card/90 backdrop-blur-sm rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Route Preview</span>
              </div>
              <Button
                size="sm"
                className="bg-gradient-neon hover:shadow-neon transition-smooth"
                onClick={onFullScreenOpen}
              >
                Navigate
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapPreview;