import { useParams, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/StatusPill';
import { DistanceBadge } from '@/components/ui/DistanceBadge';
import { useAppStore } from '@/store/app';
import { openGoogleMapsAddress } from '@/utils/maps';
import { MapPin, Clock, IndianRupee, ExternalLink, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useAppStore((state) => state.getOrderById(id || ''));

  if (!order) {
    return (
      <AppShell showTabBar={false}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Order not found</p>
          <Button onClick={() => navigate('/home')}>Back to Home</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell showTabBar={false}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 py-4"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/home')}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{order.id}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusPill status={order.status} />
              <DistanceBadge distance={order.distanceKm} />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="rounded-2xl border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                Pickup Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{order.pickup}</p>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={() => openGoogleMapsAddress(order.pickup)}
              >
                <ExternalLink className="h-4 w-4" />
                Open in Google Maps
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{order.drop}</p>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl"
                onClick={() => openGoogleMapsAddress(order.drop)}
              >
                <ExternalLink className="h-4 w-4" />
                Open in Google Maps
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Estimated Time
              </div>
              <span className="font-medium">{order.etaMin} minutes</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Distance
              </div>
              <span className="font-medium">{order.distanceKm} km</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IndianRupee className="h-4 w-4" />
                Payout
              </div>
              <span className="font-bold text-lg text-green-600">₹{order.payout}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['Created', 'Accepted', 'Picked Up', 'Delivered'].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className={index === 0 ? 'font-medium' : 'text-muted-foreground'}>{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 sticky bottom-20 pb-4">
          <Button
            variant="outline"
            className="rounded-xl h-12"
            onClick={() => console.log('Accept order')}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Accept
          </Button>
          
          <Button
            variant="outline"
            className="rounded-xl h-12"
            onClick={() => console.log('Mark as picked')}
          >
            Picked Up
          </Button>
          
          <Button
            className="rounded-xl h-12"
            onClick={() => console.log('Mark as delivered')}
          >
            Delivered
          </Button>
          
          <Button
            variant="destructive"
            className="rounded-xl h-12"
            onClick={() => console.log('Cancel order')}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </motion.div>
    </AppShell>
  );
}
