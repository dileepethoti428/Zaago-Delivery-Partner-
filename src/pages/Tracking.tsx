import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import TrackingMap from "@/components/TrackingMap";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Navigation, 
  Phone, 
  MessageCircle,
  MapPin,
  Clock,
  CheckCircle,
  Package,
  Truck,
  AlertTriangle,
  Settings
} from "lucide-react";

// Define delivery status type
type DeliveryStatus = 'Pending' | 'On the Way' | 'Arrived' | 'Delivered';

// Mock data matching the requirements from the prompt
const mockTrackingData = {
  order_id: "ORD123",
  customer_name: "Rohit Sharma",
  customer_address: "Sector 21, Phagwara",
  agent_location: { lat: 31.3240, lng: 75.5625 }, // Phagwara coordinates
  customer_location: { lat: 31.3346, lng: 75.5726 }, // Near Phagwara
  distance_km: 2.5,
  estimated_time: "25 mins",
  delivery_status: 'On the Way' as DeliveryStatus,
  special_instructions: "Leave at door. Ring bell twice.",
  priority_level: 'High' as const,
  total_amount: 130
};

const Tracking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  
  // State management
  const [orderData, setOrderData] = useState(mockTrackingData);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [isLoadingToken, setIsLoadingToken] = useState(true);

  // Fetch Mapbox token from Supabase secrets
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        setIsLoadingToken(true);
        
        // Call Supabase Edge Function to get Mapbox token
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          throw error;
        }
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          throw new Error('No token received from server');
        }
        
        setIsLoadingToken(false);
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        setIsLoadingToken(false);
        toast({
          title: "Map Token Error",
          description: "Please ensure your Mapbox token is configured in Supabase secrets",
          variant: "destructive",
        });
      }
    };

    fetchMapboxToken();
  }, [toast]);

  // Handle status updates
  const handleStatusUpdate = (newStatus: string) => {
    setOrderData(prev => ({
      ...prev,
      delivery_status: newStatus as any
    }));

    // Show appropriate toast message
    let message = '';
    switch (newStatus) {
      case 'On the Way':
        message = 'Delivery started! Customer will be notified.';
        break;
      case 'Arrived':
        message = 'Marked as arrived. Ready for delivery!';
        break;
      case 'Delivered':
        message = 'Order completed successfully!';
        break;
    }

    toast({
      title: "Status Updated",
      description: message,
    });

    // If delivered, navigate back after delay
    if (newStatus === 'Delivered') {
      setTimeout(() => {
        navigate('/home');
      }, 3000);
    }
  };

  // Handle real-time location updates (simulated)
  useEffect(() => {
    if (orderData.delivery_status === 'Delivered') return;

    const interval = setInterval(() => {
      setOrderData(prev => {
        // Simulate moving towards customer
        const deltaLat = (prev.customer_location.lat - prev.agent_location.lat) * 0.02;
        const deltaLng = (prev.customer_location.lng - prev.agent_location.lng) * 0.02;
        
        return {
          ...prev,
          agent_location: {
            lat: prev.agent_location.lat + deltaLat,
            lng: prev.agent_location.lng + deltaLng
          }
        };
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [orderData.delivery_status]);

  if (isLoadingToken) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Card className="bg-card/80 backdrop-blur-lg border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Loading Map...</h3>
            <p className="text-muted-foreground">Initializing live tracking</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!mapboxToken || mapboxToken === 'pk.your-mapbox-token-here') {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-lg border-destructive/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Mapbox Token Required</h3>
            <p className="text-muted-foreground mb-4">
              To enable live tracking, please add your Mapbox public token to Supabase secrets.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => window.open('https://mapbox.com', '_blank')}
                className="w-full bg-gradient-neon hover:shadow-neon transition-smooth"
              >
                <Settings className="w-4 h-4 mr-2" />
                Get Mapbox Token
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/home')}
                className="w-full border-border"
              >
                Return to Home
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Add the token as 'MAPBOX_PUBLIC_TOKEN' in your Supabase Edge Function secrets.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Header - minimal for map view */}
      <div className="bg-gray-900/95 backdrop-blur-lg border-b border-gray-700 p-3 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/home')}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white">Live Tracking</h1>
            <p className="text-sm text-gray-300">#{orderData.order_id}</p>
          </div>
        </div>
        
        <Badge className={`${
          orderData.delivery_status === 'Delivered' ? 'bg-green-500' :
          orderData.delivery_status === 'Arrived' ? 'bg-orange-500' :
          orderData.delivery_status === 'On the Way' ? 'bg-blue-500' :
          'bg-yellow-500'
        } text-white animate-pulse`}>
          {orderData.delivery_status}
        </Badge>
      </div>

      {/* Full-screen Map */}
      <div className="flex-1 relative">
        <TrackingMap
          orderData={orderData}
          onStatusUpdate={handleStatusUpdate}
          mapboxToken={mapboxToken}
        />
      </div>
    </div>
  );
};

export default Tracking;