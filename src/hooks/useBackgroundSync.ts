import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface QueuedAction {
  type: string;
  data: any;
  timestamp: number;
  retries?: number;
}

export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [queueSize, setQueueSize] = useState(0);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerBackgroundSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully');
          
          // Listen for sync events
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            console.log('✅ Background Sync supported');
          }
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);

  // Queue action for background sync
  const queueAction = useCallback(async (action: Omit<QueuedAction, 'timestamp'>) => {
    if (!isOnline) {
      try {
        // Add to IndexedDB queue
        await addToQueue(action);
        setQueueSize(prev => prev + 1);
        
        // Register for background sync (if supported)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          // Check if sync is available (not all browsers support it)
          if ('sync' in registration) {
            (registration as any).sync.register('background-sync');
          }
        }
        
        console.log('📝 Action queued for background sync:', action.type);
        return true;
      } catch (error) {
        console.error('❌ Failed to queue action:', error);
        return false;
      }
    } else {
      // Execute immediately if online
      try {
        await executeAction(action);
        return true;
      } catch (error) {
        // Queue for retry if execution fails
        await addToQueue({ ...action, retries: 0 });
        setQueueSize(prev => prev + 1);
        return false;
      }
    }
  }, [isOnline]);

  // Execute action immediately
  const executeAction = useCallback(async (action: Omit<QueuedAction, 'timestamp'>) => {
    setSyncStatus('syncing');
    
    try {
      switch (action.type) {
        case 'accept_order':
          // Handle order acceptance
          await fetch('/functions/v1/accept-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
          });
          break;
          
        case 'update_location':
          // Handle location updates
          await fetch('/rest/v1/driver_locations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
          });
          break;
          
        case 'complete_delivery':
          // Handle delivery completion
          await fetch('/functions/v1/complete-delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.data)
          });
          break;
          
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      setSyncStatus('idle');
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['available-orders'] });
      
    } catch (error) {
      setSyncStatus('error');
      throw error;
    }
  }, [queryClient]);

  // Trigger background sync
  const triggerBackgroundSync = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      // Check if sync is available (not all browsers support it)
      if ('sync' in registration) {
        await (registration as any).sync.register('background-sync');
      }
    }
  }, []);

  // Get queue size
  const updateQueueSize = useCallback(async () => {
    try {
      const actions = await getQueuedActions();
      setQueueSize(actions.length);
    } catch (error) {
      console.error('❌ Failed to get queue size:', error);
    }
  }, []);

  // Clear queue
  const clearQueue = useCallback(async () => {
    try {
      await clearActionQueue();
      setQueueSize(0);
      console.log('✅ Sync queue cleared');
    } catch (error) {
      console.error('❌ Failed to clear queue:', error);
    }
  }, []);

  return {
    isOnline,
    syncStatus,
    queueSize,
    queueAction,
    executeAction,
    triggerBackgroundSync,
    updateQueueSize,
    clearQueue,
  };
};

// IndexedDB helpers
async function addToQueue(action: Omit<QueuedAction, 'timestamp'>) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ZaagoSyncDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      const actionWithTimestamp: QueuedAction = {
        ...action,
        timestamp: Date.now(),
      };
      
      const addRequest = store.add(actionWithTimestamp);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function getQueuedActions(): Promise<QueuedAction[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZaagoSyncDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const getRequest = store.getAll();
      
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

async function clearActionQueue() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('ZaagoSyncDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    };
  });
}