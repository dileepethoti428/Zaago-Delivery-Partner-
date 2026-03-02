// Service Worker for background sync and caching
const CACHE_VERSION = 'v3';
const CACHE_NAME = `zaago-cache-${CACHE_VERSION}`;
const API_CACHE = `zaago-api-cache-${CACHE_VERSION}`;
const BACKGROUND_SYNC_TAG = 'background-sync';

// Ringtone files for notifications
const RINGTONE_FILES = {
  'iphone-6-ringtone': '/iphone-6-original-ringtone.mp3',
  'rapido-ringtone': '/rapido-ringtone.mp3',
  'phone-ringtone': '/phone-ringtone.mp3',
  'notification-sound': '/notification-sound.mp3'
};

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static assets');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('📦 Service Worker installed successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete ALL old caches that don't match current version
            if (!cacheName.includes(CACHE_VERSION)) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('🔄 Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NEVER cache Supabase API calls - always fetch fresh
  if (url.hostname.includes('supabase.co')) {
    return; // Let browser handle natively
  }

  // Handle API requests — let browser handle natively
  if (url.pathname.includes('/functions/v1/') || url.pathname.includes('/rest/v1/')) {
    return; // Let browser handle natively
  }

  // Cache static assets aggressively
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image' ||
      request.destination === 'font' ||
      request.destination === 'audio') {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(request));
    return;
  }
});

// Network-first strategy for API calls
async function networkFirstStrategy(request) {
  const cacheName = API_CACHE;
  
  try {
    // Try network first
    const networkResponse = await fetch(request.clone());
    
    // If successful, cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📶 Network failed, trying cache for:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Both failed, return offline response
    return new Response(JSON.stringify({
      error: 'Offline',
      message: 'No network connection and no cached data available'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.log('📶 Failed to fetch asset:', request.url);
    return new Response('Asset not available offline', { status: 404 });
  }
}

// Navigation strategy for page requests
async function navigationStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Return cached index.html for offline navigation
    // The React app will detect offline status and show the Offline page
    const cachedResponse = await caches.match('/');
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return a basic offline HTML page if nothing is cached
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>Offline</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center;">
            <h1>You're Offline</h1>
            <p>Please check your internet connection.</p>
          </div>
        </body>
      </html>
    `, { 
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  if (event.tag === BACKGROUND_SYNC_TAG) {
    event.waitUntil(
      processBackgroundSync()
    );
  }
});

// Process background sync queue
async function processBackgroundSync() {
  try {
    // Get queued actions from IndexedDB
    const queuedActions = await getQueuedActions();
    
    for (const action of queuedActions) {
      try {
        await processQueuedAction(action);
        await removeFromQueue(action.id);
        console.log('✅ Processed queued action:', action.type);
      } catch (error) {
        console.log('❌ Failed to process queued action:', action.type, error);
        // Keep in queue for retry
      }
    }
  } catch (error) {
    console.log('❌ Background sync failed:', error);
  }
}

// IndexedDB helpers for queue management
async function getQueuedActions() {
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
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function processQueuedAction(action) {
  // Process different types of queued actions
  switch (action.type) {
    case 'accept_order':
      return await fetch('/functions/v1/accept-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.data)
      });
    
    case 'update_location':
      return await fetch('/rest/v1/driver_locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.data)
      });
    
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function removeFromQueue(actionId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZaagoSyncDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const deleteRequest = store.delete(actionId);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'QUEUE_ACTION':
      queueAction(payload);
      break;
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({ type: 'CACHE_STATUS', payload: status });
      });
      break;
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
  }
});

async function queueAction(action) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZaagoSyncDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      
      const actionWithTimestamp = {
        ...action,
        timestamp: Date.now(),
      };
      
      const addRequest = store.add(actionWithTimestamp);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    };
  });
}

async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const sizes = await Promise.all(
    cacheNames.map(async (name) => {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      return { name, count: keys.length };
    })
  );
  
  return {
    caches: sizes,
    totalCaches: cacheNames.length,
  };
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

// Push notification handler - CRITICAL for background notifications
self.addEventListener('push', (event) => {
  console.log('🔔 [SW-PUSH] Push notification received:', event);
  
  let notificationData = {
    title: '🚨 New Order Available',
    body: 'A new delivery order is ready to be picked up',
    icon: '/zaago-logo-favicon.png',
    badge: '/zaago-delivery-favicon.png',
    tag: 'order-notification',
    requireInteraction: true,
    vibrate: [500, 150, 500, 150, 500, 150, 500],
    sound: '/iphone-6-original-ringtone.mp3', // Add sound to notification
    data: {
      url: '/home',
      play_audio: true,
      order_id: null,
      notification_type: 'order_available',
      auto_open_app: true // Flag to auto-open app for audio
    },
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('📦 [SW-PUSH] Push payload:', payload);
      
      notificationData = {
        ...notificationData,
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        requireInteraction: payload.requireInteraction !== false,
        vibrate: payload.vibrate || notificationData.vibrate,
        sound: payload.sound || notificationData.sound,
        data: {
          ...notificationData.data,
          ...payload.data
        }
      };
    } catch (error) {
      console.error('[SW-PUSH] Error parsing push payload:', error);
    }
  }

  console.log('🔔 [SW-PUSH] Showing notification:', notificationData.title);

  // Show notification, auto-open app, and play audio
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationData.title, notificationData),
      playBackgroundAudio(),
      // Auto-open app to ensure audio plays
      autoOpenAppForAudio(notificationData.data)
    ]).then(() => {
      console.log('✅ [SW-PUSH] Notification displayed and audio triggered');
    }).catch(error => {
      console.error('[SW-PUSH] Error showing notification:', error);
    })
  );
});

// Notification click handler - Opens app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW-CLICK] Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/home';
  const orderId = event.notification.data?.order_id;

  console.log(`📱 [SW-CLICK] Opening app to: ${urlToOpen}`, orderId ? `for order ${orderId}` : '');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            console.log('✅ [SW-CLICK] Focusing existing window');
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          console.log('🆕 [SW-CLICK] Opening new window');
          return clients.openWindow(urlToOpen);
        }
      })
      .catch(error => {
        console.error('[SW-CLICK] Error handling notification click:', error);
      })
  );
});

// Auto-open app when notification arrives to ensure audio plays
async function autoOpenAppForAudio(data) {
  try {
    if (!data?.auto_open_app) {
      return;
    }

    console.log('🚀 [SW-AUTO-OPEN] Attempting to auto-open app for audio playback');

    const allClients = await clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    });

    // If app is already open, just focus it
    if (allClients.length > 0) {
      console.log('✅ [SW-AUTO-OPEN] App already open, focusing...');
      const client = allClients[0];
      if ('focus' in client) {
        await client.focus();
      }
      return;
    }

    // App is closed - open it to play audio
    if (clients.openWindow) {
      console.log('🆕 [SW-AUTO-OPEN] Opening app in background for audio...');
      const urlToOpen = data.url || '/home';
      await clients.openWindow(urlToOpen);
      console.log('✅ [SW-AUTO-OPEN] App opened successfully');
    }
  } catch (error) {
    console.error('[SW-AUTO-OPEN] Error auto-opening app:', error);
  }
}

// Play audio in background when notification arrives - CRITICAL for closed app audio
async function playBackgroundAudio() {
  try {
    console.log('🔊 [SW-AUDIO] Attempting to play background audio');
    
    // Send message to all clients to play audio
    const allClients = await clients.matchAll({ 
      includeUncontrolled: true,
      type: 'window' 
    });
    
    console.log(`📢 [SW-AUDIO] Found ${allClients.length} client(s)`);
    
    let messagesSent = 0;
    for (const client of allClients) {
      try {
        client.postMessage({
          type: 'PLAY_NOTIFICATION_AUDIO',
          timestamp: Date.now(),
          source: 'service-worker-push',
          priority: 'high' // High priority for immediate playback
        });
        messagesSent++;
      } catch (error) {
        console.error('[SW-AUDIO] Error sending message to client:', error);
      }
    }
    
    console.log(`✅ [SW-AUDIO] Sent audio play message to ${messagesSent} client(s)`);
    
    // If no clients are open, the audio will play when app opens
    if (messagesSent === 0) {
      console.log('⚠️ [SW-AUDIO] No active clients - will auto-open app');
    }
  } catch (error) {
    console.error('[SW-AUDIO] Error playing background audio:', error);
  }
}

console.log('🚀 Service Worker loaded successfully');
