import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getOfflineCompletions, getAgentPayouts, OfflineCompletion } from '@/lib/offlineCompletions';
import { formatDistanceToNow } from 'date-fns';
import { Package, Clock, DollarSign, Wifi, WifiOff } from 'lucide-react';

export const OfflineCompletionsQueue = () => {
  const [completions, setCompletions] = useState<OfflineCompletion[]>([]);
  const [payouts, setPayouts] = useState({ totalEarnings: 0, pendingEarnings: 0, lastUpdated: null });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const loadData = () => {
      setCompletions(getOfflineCompletions());
      setPayouts(getAgentPayouts());
    };

    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const pendingCompletions = completions.filter(c => c.status === 'completed');

  if (pendingCompletions.length === 0 && payouts.pendingEarnings === 0) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isOnline ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
          Offline Completions Queue
          {pendingCompletions.length > 0 && (
            <Badge variant="secondary">{pendingCompletions.length} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payout Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">Pending Earnings</span>
            </div>
            <p className="text-lg font-semibold text-green-700">₹{payouts.pendingEarnings}</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-600">Total Completed</span>
            </div>
            <p className="text-lg font-semibold text-blue-700">{completions.length}</p>
          </div>
        </div>

        {/* Recent Completions */}
        {pendingCompletions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Recent Offline Completions</h4>
            {pendingCompletions.slice(0, 3).map((completion) => (
              <div key={completion.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{completion.customerName}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{completion.totalAmount} • {completion.paymentMethod}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">₹{completion.payout}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(completion.completedAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
            {pendingCompletions.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                +{pendingCompletions.length - 3} more pending sync...
              </p>
            )}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="default" className="bg-green-100 text-green-700">
                Online - Will sync automatically
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                Offline - Queued for sync
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};