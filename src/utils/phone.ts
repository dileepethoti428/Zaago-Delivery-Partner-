import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

export async function callPhone(phone?: string | null): Promise<void> {
  if (!phone) return;
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (!digits) return;
  const url = `tel:${digits}`;

  try {
    if (Capacitor.isNativePlatform()) {
      await AppLauncher.openUrl({ url });
      return;
    }
  } catch (err) {
    console.error('[callPhone] AppLauncher failed', err);
  }
  // Web fallback
  window.location.href = url;
}
