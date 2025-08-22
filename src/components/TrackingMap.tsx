import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Navigation, 
  MapPin, 
  Timer, 
  Phone, 
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Route,
  User,
  Package,
  Clock
} from 'lucide-react';

interface TrackingMapProps {
  orderData: {
    order_id: string;
    customer_name: string;
    customer_address: string;
    agent_location: { lat: number; lng: number };
    customer_location: { lat: number; lng: number };
    distance_km: number;
    estimated_time: string;
    delivery_status: 'Pending' | 'On the Way' | 'Arrived' | 'Delivered';
    special_instructions?: string;
    priority_level: 'High' | 'Medium' | 'Low';
    total_amount: number;
  };
  onStatusUpdate: (status: string) => void;
  mapboxToken: string;
}

const TrackingMap: React.FC<TrackingMapProps> = ({ 
  orderData, 
  onStatusUpdate, 
  mapboxToken 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const agentMarker = useRef<mapboxgl.Marker | null>(null);
  const customerMarker = useRef<mapboxgl.Marker | null>(null);
  
  const [currentLocation, setCurrentLocation] = useState(orderData.agent_location);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1', // Dark navigation style
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 15,
      pitch: 60,
      bearing: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
      }),
      'top-right'
    );

    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.current.addControl(geolocate, 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;
      
      setIsMapLoaded(true);

      // Create custom agent marker
      const agentEl = document.createElement('div');
      agentEl.className = 'agent-marker';
      agentEl.innerHTML = `
        <div class="w-12 h-12 bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full flex items-center justify-center shadow-lg animate-pulse border-2 border-white">
          <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z"/>
          </svg>
        </div>
        <div class="absolute top-0 left-0 w-full h-full bg-cyan-400 rounded-full opacity-30 animate-ping"></div>
      `;

      agentMarker.current = new mapboxgl.Marker({ element: agentEl })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-2 bg-gray-900 text-white rounded">
                <div class="font-semibold">Your Location</div>
                <div class="text-sm text-gray-300">Agent Position</div>
              </div>
            `)
        )
        .addTo(map.current);

      // Create custom customer marker
      const customerEl = document.createElement('div');
      customerEl.className = 'customer-marker';
      customerEl.innerHTML = `
        <div class="w-10 h-10 bg-gradient-to-r from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
          <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `;

      customerMarker.current = new mapboxgl.Marker({ element: customerEl })
        .setLngLat([orderData.customer_location.lng, orderData.customer_location.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div class="p-3 bg-gray-900 text-white rounded max-w-xs">
                <div class="font-semibold">${orderData.customer_name}</div>
                <div class="text-sm text-gray-300 mt-1">${orderData.customer_address}</div>
                ${orderData.special_instructions ? `
                  <div class="text-xs text-yellow-300 mt-2 p-2 bg-yellow-900/30 rounded">
                    📝 ${orderData.special_instructions}
                  </div>
                ` : ''}
              </div>
            `)
        )
        .addTo(map.current);

      // Add route
      addRoute();
      
      // Fit bounds to show both markers
      fitMapToBounds();
    });

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  // Add route between agent and customer
  const addRoute = async () => {
    if (!map.current) return;

    const start = [currentLocation.lng, currentLocation.lat];
    const end = [orderData.customer_location.lng, orderData.customer_location.lat];

    try {
      // Simple straight line route for demo
      const routeGeoJSON = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: [start, end]
        }
      };

      // Add route source
      if (map.current.getSource('route')) {
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData(routeGeoJSON);
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: routeGeoJSON
        });

        // Add route layer with gradient effect
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
            'line-width': 6,
            'line-opacity': 0.8,
            'line-gradient': [
              'interpolate',
              ['linear'],
              ['line-progress'],
              0, '#00FFAA',
              1, '#00FFDD'
            ]
          }
        });

        // Add route outline
        map.current.addLayer({
          id: 'route-outline',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 8,
            'line-opacity': 0.3
          }
        }, 'route');
      }
    } catch (error) {
      console.error('Error adding route:', error);
    }
  };

  // Fit map to show both markers
  const fitMapToBounds = () => {
    if (!map.current) return;
    
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([currentLocation.lng, currentLocation.lat]);
    bounds.extend([orderData.customer_location.lng, orderData.customer_location.lat]);
    
    map.current.fitBounds(bounds, {
      padding: { top: 100, bottom: 300, left: 50, right: 50 },
      maxZoom: 16
    });
  };

  // Simulate location updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate movement towards customer
      setCurrentLocation(prev => {
        const newLat = prev.lat + (orderData.customer_location.lat - prev.lat) * 0.01;
        const newLng = prev.lng + (orderData.customer_location.lng - prev.lng) * 0.01;
        
        if (agentMarker.current) {
          agentMarker.current.setLngLat([newLng, newLat]);
        }
        
        return { lat: newLat, lng: newLng };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [orderData.customer_location]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-500';
      case 'On the Way':
        return 'bg-blue-500';
      case 'Arrived':
        return 'bg-orange-500';
      case 'Delivered':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'border-red-500 bg-red-500/10';
      case 'Medium':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'Low':
        return 'border-green-500 bg-green-500/10';
      default:
        return 'border-primary bg-primary/10';
    }
  };

  // Get next action based on status
  const getNextAction = () => {
    switch (orderData.delivery_status) {
      case 'Pending':
        return { label: 'Start Delivery', status: 'On the Way', icon: Route };
      case 'On the Way':
        return { label: 'Mark Arrived', status: 'Arrived', icon: MapPin };
      case 'Arrived':
        return { label: 'Complete Delivery', status: 'Delivered', icon: CheckCircle };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Loading Overlay */}
      {!isMapLoaded && (
        <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold">Loading Map...</p>
            <p className="text-sm text-gray-300">Initializing tracking</p>
          </div>
        </div>
      )}

      {/* Floating Info Panel */}
      {showInfoPanel && isMapLoaded && (
        <Card className={`absolute top-4 left-4 right-4 bg-gray-900/95 backdrop-blur-lg border-2 ${getPriorityColor(orderData.priority_level)} shadow-2xl animate-slide-up z-10`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  <div>
                    <p className="font-bold text-white">#{orderData.order_id}</p>
                    <p className="text-sm text-gray-300">{orderData.customer_name}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge className={`${getStatusColor(orderData.delivery_status)} text-white animate-pulse`}>
                  {orderData.delivery_status}
                </Badge>
                <Badge className="bg-red-500 text-white">
                  {orderData.priority_level}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="flex items-center space-x-2 text-gray-300">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="text-sm">{orderData.distance_km} km</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-sm">{orderData.estimated_time}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-gray-300 mb-3">
              <MapPin className="w-4 h-4 text-red-400" />
              <span className="text-sm">{orderData.customer_address}</span>
            </div>

            {orderData.special_instructions && (
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3 mb-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-400">Special Instructions</p>
                    <p className="text-sm text-gray-300 mt-1">{orderData.special_instructions}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Phone className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfoPanel(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-800 ml-auto"
              >
                Hide
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show Info Panel Button (when hidden) */}
      {!showInfoPanel && isMapLoaded && (
        <Button
          onClick={() => setShowInfoPanel(true)}
          className="absolute top-4 left-4 bg-gray-900/95 backdrop-blur-lg border border-gray-600 text-white hover:bg-gray-800 z-10"
        >
          <Package className="w-4 h-4 mr-2" />
          Show Details
        </Button>
      )}

      {/* Action Buttons */}
      {nextAction && isMapLoaded && (
        <div className="absolute bottom-6 left-4 right-4 z-10">
          <div className="flex flex-col space-y-3">
            {/* Main Action Button */}
            <Button
              onClick={() => onStatusUpdate(nextAction.status)}
              className="w-full h-14 bg-gradient-to-r from-cyan-400 to-cyan-600 hover:from-cyan-500 hover:to-cyan-700 text-white font-bold text-lg shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105"
            >
              <nextAction.icon className="w-6 h-6 mr-3" />
              {nextAction.label}
            </Button>

            {/* Secondary Actions */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                className="flex-1 bg-gray-900/80 backdrop-blur-lg border-gray-600 text-gray-300 hover:bg-gray-800"
                onClick={fitMapToBounds}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Center Map
              </Button>
              <Button
                variant="outline"
                className="flex-1 bg-gray-900/80 backdrop-blur-lg border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Timer className="w-4 h-4 mr-2" />
                ₹{orderData.total_amount}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Complete Message */}
      {orderData.delivery_status === 'Delivered' && isMapLoaded && (
        <div className="absolute bottom-6 left-4 right-4 z-10">
          <Card className="bg-green-900/95 backdrop-blur-lg border-2 border-green-500 shadow-2xl">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-xl font-bold text-white mb-2">Delivery Completed!</h3>
              <p className="text-green-300 mb-4">Order #{orderData.order_id} has been delivered successfully</p>
              <Button
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={() => window.history.back()}
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TrackingMap;