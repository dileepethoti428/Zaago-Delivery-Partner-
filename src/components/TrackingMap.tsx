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
    id: string;
    customer_name: string;
    customer_phone?: string;
    customer_location?: { lat: number; lng: number };
    address?: any;
    distance?: number;
    estimated_time?: number;
    delivery_status?: string;
    priority?: string;
    pickup_location?: { lat: number; lng: number };
    pickup_address?: string;
    pickup_status?: string;
    seller_name?: string;
    seller_phone?: string;
    total?: number;
  };
  onStatusUpdate: (newStatus: string) => void;
  mapboxToken: string;
}

const TrackingMap: React.FC<TrackingMapProps> = ({ 
  orderData, 
  onStatusUpdate, 
  mapboxToken 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  
  const [agentLocation] = useState({
    lat: 12.9716,
    lng: 77.5946
  });
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  // Initialize map and set up markers
  useEffect(() => {
    if (!mapContainer.current || !orderData.customer_location) return;

    // Initialize map
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [orderData.customer_location.lng, orderData.customer_location.lat],
      zoom: 13
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocate control
    const geolocate = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserHeading: true
    });
    map.addControl(geolocate, 'top-right');

    // Create agent marker with pulsing animation
    const agentMarker = document.createElement('div');
    agentMarker.className = 'w-6 h-6 bg-blue-500 rounded-full animate-ping absolute';
    agentMarker.innerHTML = `
      <div class="w-full h-full bg-blue-600 rounded-full flex items-center justify-center">
        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2L3 7v11h4v-6h6v6h4V7l-7-5z"/>
        </svg>
      </div>
    `;

    const agentMapboxMarker = new mapboxgl.Marker({ element: agentMarker })
      .setLngLat([agentLocation.lng, agentLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <div class="text-sm">
          <h3 class="font-bold text-gray-900">Delivery Agent</h3>
          <p class="text-gray-600">Your agent is on the way</p>
        </div>
      `))
      .addTo(map);

    // Create pickup marker if pickup location exists
    if (orderData.pickup_location) {
      const pickupMarker = document.createElement('div');
      pickupMarker.className = 'w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center';
      pickupMarker.innerHTML = `
        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
        </svg>
      `;

      new mapboxgl.Marker({ element: pickupMarker })
        .setLngLat([orderData.pickup_location.lng, orderData.pickup_location.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`
          <div class="text-sm">
            <h3 class="font-bold text-gray-900">Pickup Location</h3>
            <p class="text-gray-600">${orderData.seller_name || 'Store'}</p>
            <p class="text-gray-600">${orderData.pickup_address || ''}</p>
            ${orderData.seller_phone ? `<p class="text-gray-600">${orderData.seller_phone}</p>` : ''}
          </div>
        `))
        .addTo(map);
    }

    // Create customer marker
    const customerMarker = document.createElement('div');
    customerMarker.className = 'w-6 h-6 bg-red-500 rounded-full flex items-center justify-center';
    customerMarker.innerHTML = `
      <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
      </svg>
    `;

    new mapboxgl.Marker({ element: customerMarker })
      .setLngLat([orderData.customer_location.lng, orderData.customer_location.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <div class="text-sm">
          <h3 class="font-bold text-gray-900">${orderData.customer_name}</h3>
          <p class="text-gray-600">Delivery destination</p>
          ${orderData.customer_phone ? `<p class="text-gray-600">${orderData.customer_phone}</p>` : ''}
        </div>
      `))
      .addTo(map);

    // Set map instance
    mapInstance.current = map;
    setIsMapLoaded(true);

    // Add route and fit bounds when map loads
    map.on('load', () => {
      addRoute();
      fitMapToBounds();
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [orderData, mapboxToken]);

  // Add route between agent, pickup, and customer
  const addRoute = () => {
    if (!mapInstance.current) return;

    let routeCoords = [];
    
    if (orderData.pickup_location) {
      // Two-leg route: Agent → Pickup → Customer
      routeCoords = [
        [agentLocation.lng, agentLocation.lat],
        [orderData.pickup_location.lng, orderData.pickup_location.lat],
        [orderData.customer_location!.lng, orderData.customer_location!.lat]
      ];
    } else {
      // Direct route: Agent → Customer
      routeCoords = [
        [agentLocation.lng, agentLocation.lat],
        [orderData.customer_location!.lng, orderData.customer_location!.lat]
      ];
    }

    // Add route line
    mapInstance.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoords
        }
      }
    });

    // Add route layer with gradient effect
    mapInstance.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3B82F6',
        'line-width': 4,
        'line-opacity': 0.8
      }
    });

    // Add route outline
    mapInstance.current.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#1E40AF',
        'line-width': 6,
        'line-opacity': 0.4
      }
    }, 'route');
  };

  // Fit map to show agent, pickup, and customer
  const fitMapToBounds = () => {
    if (!mapInstance.current) return;

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([agentLocation.lng, agentLocation.lat]);
    
    if (orderData.pickup_location) {
      bounds.extend([orderData.pickup_location.lng, orderData.pickup_location.lat]);
    }
    
    bounds.extend([orderData.customer_location!.lng, orderData.customer_location!.lat]);

    mapInstance.current.fitBounds(bounds, {
      padding: 60,
      maxZoom: 14
    });
  };

  // Get status color for badges
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in_transit':
      case 'on the way':
        return 'bg-blue-100 text-blue-800';
      case 'arrived':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Return status badge CSS classes based on priority
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Get the next action button based on delivery and pickup status
  const getNextAction = () => {
    const hasPickup = orderData.pickup_location;
    const pickupStatus = orderData.pickup_status || 'pending';
    
    if (hasPickup && pickupStatus === 'pending') {
      return { text: 'Go to Pickup', action: 'going_to_pickup' };
    }
    
    if (hasPickup && pickupStatus === 'going_to_pickup') {
      return { text: 'Mark Picked Up', action: 'picked_up' };
    }
    
    switch (orderData.delivery_status) {
      case 'pending':
      case 'assigned':
        return hasPickup && pickupStatus === 'picked_up' 
          ? { text: 'Start Delivery', action: 'in_transit' }
          : { text: 'Start Delivery', action: 'in_transit' };
      case 'in_transit':
        return { text: 'Mark Arrived', action: 'arrived' };
      case 'arrived':
        return { text: 'Complete Delivery', action: 'delivered' };
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Loading Overlay */}
      {!isMapLoaded && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mx-auto mb-4"></div>
            <p>Loading map...</p>
          </div>
        </div>
      )}

      {/* Info Panel */}
      {showInfoPanel && (
        <Card className="absolute top-4 left-4 right-4 z-40 bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Delivery Tracking</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInfoPanel(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </Button>
            </div>

            {/* Pickup Details */}
            {orderData.pickup_location && (
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-orange-900 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                    </svg>
                    Pickup Location
                  </h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    orderData.pickup_status === 'picked_up' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {orderData.pickup_status === 'picked_up' ? 'Picked Up' : 'Pending Pickup'}
                  </span>
                </div>
                <p className="text-sm text-orange-800">{orderData.seller_name || 'Store'}</p>
                <button
                  onClick={() => window.open(`https://www.google.com/maps?q=${orderData.pickup_location?.lat},${orderData.pickup_location?.lng}&z=15`)}
                  className="text-sm text-orange-600 hover:text-orange-800 underline cursor-pointer block mt-1"
                >
                  📍 {orderData.pickup_address}
                </button>
                <div className="flex space-x-2 mt-2">
                  {orderData.seller_phone && (
                    <button 
                      onClick={() => window.open(`tel:${orderData.seller_phone}`)}
                      className="text-sm text-orange-700 hover:text-orange-900 flex items-center"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                      </svg>
                      Call Store
                    </button>
                  )}
                  <button
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${orderData.pickup_location?.lat},${orderData.pickup_location?.lng}`)}
                    className="text-sm text-orange-700 hover:text-orange-900 flex items-center"
                  >
                    <Navigation className="w-3 h-3 mr-1" />
                    Navigate
                  </button>
                </div>
              </div>
            )}

            {/* Order Details */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-blue-900 flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Delivery Location
                </h4>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-900">
                    {orderData.distance ? `${orderData.distance} km` : 'Distance unknown'}
                  </p>
                  <p className="text-sm text-blue-600">
                    {orderData.estimated_time ? `${orderData.estimated_time} min` : 'ETA unknown'}
                  </p>
                </div>
              </div>
              <h3 className="font-semibold text-blue-900">{orderData.customer_name}</h3>
              <button
                onClick={() => window.open(`https://www.google.com/maps?q=${orderData.customer_location?.lat},${orderData.customer_location?.lng}&z=15`)}
                className="text-sm text-blue-600 hover:text-blue-800 underline cursor-pointer block mt-1"
              >
                 📍 {(() => {
                   if (typeof orderData.address === 'string') return orderData.address;
                   if (orderData.address?.full_address) return orderData.address.full_address;
                   if (orderData.address?.addressLine1) return `${orderData.address.addressLine1}, ${orderData.address.city || ''}`;
                   if (orderData.address?.address) {
                     // Handle {city, state, address, pincode} structure
                     const parts = [
                       orderData.address.address,
                       orderData.address.city,
                       orderData.address.state,
                       orderData.address.pincode
                     ].filter(Boolean);
                     return parts.join(', ');
                   }
                   if (typeof orderData.address === 'object' && orderData.address) {
                     // Fallback for any other object structure
                     const addressStr = Object.values(orderData.address).filter(Boolean).join(', ');
                     return addressStr || 'Delivery address not available';
                   }
                   return 'Delivery address not available';
                 })()}
              </button>
              {orderData.customer_phone && (
                <p className="text-sm text-blue-500 mt-1">{orderData.customer_phone}</p>
              )}
              <button
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${orderData.customer_location?.lat},${orderData.customer_location?.lng}`)}
                className="mt-2 text-sm text-blue-700 hover:text-blue-900 flex items-center"
              >
                <Navigation className="w-3 h-3 mr-1" />
                Navigate to Customer
              </button>
            </div>

            {/* Status and Action Buttons */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(orderData.delivery_status || 'pending')}>
                  {orderData.delivery_status || 'Pending'}
                </Badge>
                {orderData.priority && (
                  <Badge variant="outline" className={getPriorityColor(orderData.priority)}>
                    {orderData.priority} Priority
                  </Badge>
                )}
              </div>

              {/* Contact Buttons */}
              <div className="flex space-x-2">
                {orderData.customer_phone && (
                  <button
                    onClick={() => window.open(`tel:${orderData.customer_phone}`)}
                    className="flex-1 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg text-sm"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </button>
                )}
                <button
                  onClick={() => window.open(`https://wa.me/?text=Order%20${orderData.id}%20delivery%20update`)}
                  className="flex-1 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg text-sm"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </button>
              </div>

              {/* Action Button */}
              {(() => {
                const nextAction = getNextAction();
                return nextAction ? (
                  <Button
                    onClick={() => onStatusUpdate(nextAction.action)}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {nextAction.text}
                  </Button>
                ) : null;
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Completed Message */}
      {orderData.delivery_status === 'delivered' && (
        <div className="absolute inset-0 bg-green-900/80 flex items-center justify-center z-50">
          <Card className="bg-white p-8 text-center max-w-md mx-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Completed!</h2>
            <p className="text-gray-600 mb-4">
              Order has been successfully delivered to {orderData.customer_name}
            </p>
            <p className="text-sm text-gray-500">
              Total Amount: ₹{orderData.total || 0}
            </p>
          </Card>
        </div>
      )}

      {/* Toggle Info Panel Button */}
      {!showInfoPanel && (
        <Button
          onClick={() => setShowInfoPanel(true)}
          className="absolute top-4 left-4 z-40 bg-white/90 text-gray-900 hover:bg-white"
          size="sm"
        >
          <Route className="w-4 h-4 mr-2" />
          Show Details
        </Button>
      )}
    </div>
  );
};

export default TrackingMap;