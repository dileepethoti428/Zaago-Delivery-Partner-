import { useEffect, useRef } from 'react';
import { useLocationSyncController } from './useLocationSyncController';

/**
 * Screen-level location sync hook.
 * Call this in screens that need live location (Home, MyDeliveries).
 * The underlying controller is idempotent — multiple screens won't create duplicate watchers.
 */
export function useScreenLocationSync() {
  useLocationSyncController();
}
