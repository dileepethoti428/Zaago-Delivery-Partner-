import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { supabase } from '@/integrations/supabase/client';
import { Play, Square, Volume2, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface AudioDebugPanelProps {
  settings: any;
}

export const AudioDebugPanel: React.FC<AudioDebugPanelProps> = ({ settings }) => {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [canPlay, setCanPlay] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const { playNotificationSound, testRingtone, stopRingtone } = useAudioNotification({
    enabled: settings?.ringtone_enabled ?? true,
    volume: 1.0, // Maximum volume for debug
    type: settings?.ringtone_type || 'phone-ringtone',
    frequency: 'continuous'
  });

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 10));
  };

  useEffect(() => {
    // Initialize audio context
    const initAudioContext = async () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(ctx);
        setCanPlay(ctx.state === 'running');
        addDebugInfo(`Audio context initialized: ${ctx.state}`);
      } catch (error) {
        addDebugInfo(`Audio context failed: ${error}`);
      }
    };

    initAudioContext();
  }, []);

  useEffect(() => {
    // Listen for packed order notifications
    const channel = supabase
      .channel('packed-order-notifications')
      .on('broadcast', { event: 'order_packed' }, (payload) => {
        addDebugInfo(`Order packed notification received: ${payload.orderId}`);
        setLastNotification(new Date().toLocaleTimeString());
        playNotificationSound();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playNotificationSound]);

  const handleTestNewOrderRingtone = async () => {
    addDebugInfo('Testing new order ringtone...');
    setIsPlaying(true);
    try {
      await playNotificationSound();
      addDebugInfo('New order ringtone test completed');
    } catch (error) {
      addDebugInfo(`Test failed: ${error}`);
    }
    setTimeout(() => setIsPlaying(false), 3000);
  };

  const handleTestBasicSound = async () => {
    addDebugInfo('Testing basic sound...');
    try {
      await testRingtone();
      addDebugInfo('Basic sound test completed');
    } catch (error) {
      addDebugInfo(`Basic sound test failed: ${error}`);
    }
  };

  const handleStopRingtone = () => {
    addDebugInfo('Stopping ringtone...');
    stopRingtone();
    setIsPlaying(false);
  };

  const handleTestContinuousRinging = async () => {
    addDebugInfo('Starting continuous ringing test...');
    setIsPlaying(true);
    try {
      await playNotificationSound();
      addDebugInfo('Continuous ringing started');
    } catch (error) {
      addDebugInfo(`Continuous ringing failed: ${error}`);
    }
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => (
    <Badge variant={condition ? "default" : "destructive"} className="flex items-center gap-1">
      {condition ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {condition ? trueText : falseText}
    </Badge>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Audio Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Display Section */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Status Information
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {getStatusBadge(!!audioContext, "Audio Ready", "Audio Not Ready")}
            {getStatusBadge(canPlay, "Can Play: Yes", "Can Play: No")}
            {getStatusBadge(isPlaying, "Continuous Ringing: Active", "Continuous Ringing: Inactive")}
            {getStatusBadge(settings?.ringtone_enabled, "Notifications: Enabled", "Notifications: Disabled")}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            <p>Volume: {Math.round((settings?.ringtone_volume || 0.8) * 100)}%</p>
            <p>Ringtone Type: {settings?.ringtone_type || 'phone-ringtone'}</p>
            <p>Audio Context State: {audioContext?.state || 'Not initialized'}</p>
            {lastNotification && <p>Last Notification: {lastNotification}</p>}
          </div>
        </div>

        <Separator />

        {/* Testing Controls */}
        <div>
          <h4 className="font-semibold mb-3">Testing Controls</h4>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              onClick={handleTestNewOrderRingtone}
              disabled={isPlaying}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Test New Order Ringtone
            </Button>
            <Button 
              onClick={handleStopRingtone}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop Ringtone
            </Button>
            <Button 
              onClick={handleTestBasicSound}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Volume2 className="w-4 h-4" />
              Test Basic Sound
            </Button>
            <Button 
              onClick={handleTestContinuousRinging}
              variant="outline"
              disabled={isPlaying}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Test Continuous Ringing
            </Button>
          </div>
        </div>

        <Separator />

        {/* Debug Information */}
        <div>
          <h4 className="font-semibold mb-3">Debug Log</h4>
          <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
            {debugInfo.length > 0 ? (
              <div className="space-y-1">
                {debugInfo.map((info, index) => (
                  <p key={index} className="text-xs font-mono text-muted-foreground">
                    {info}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No debug information yet...</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};