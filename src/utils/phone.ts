import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { toast } from '@/hooks/use-toast';

/**
 * Normalize a phone number for a `tel:` URI.
 * - Strips spaces, dashes, parentheses, etc.
 * - If it's a bare 10-digit Indian number, prefix +91.
 */
function normalizePhone(phone: string): string {
  let digits = String(phone).replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (/^\d{10}$/.test(digits)) {
    digits = `+91${digits}`;
  }
  return digits;
}

export async function callPhone(phone?: string | null): Promise<void> {
  if (!phone) return;
  const normalized = normalizePhone(phone);
  if (!normalized) return;
  const url = `tel:${normalized}`;

  // Native (Android/iOS): must go through AppLauncher.
  // Never fall back to window.location.href on native — the Android WebView
  // cannot resolve `tel:` and shows ERR_UNKNOWN_URL_SCHEME.
  if (Capacitor.isNativePlatform()) {
    try {
      await AppLauncher.openUrl({ url });
      return;
    } catch (err) {
      console.error('[callPhone] AppLauncher failed', err);
      try {
        window.open(url, '_system');
        return;
      } catch (err2) {
        console.error('[callPhone] system open failed', err2);
      }
      toast({
        title: 'Unable to place call',
        description: `Please dial ${normalized} manually.`,
        variant: 'destructive',
      });
      return;
    }
  }

  // Web browser: hand `tel:` to the OS via an anchor click.
  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    window.location.href = url;
  }
}
