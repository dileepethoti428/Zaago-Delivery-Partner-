// Offline queue for delivery OTP verifications.
// Never logs the OTP value.
import { supabase } from '@/integrations/supabase/client';

const KEY = 'zaago:otp-queue:v1';
const MAX = 20;

export type QueuedOtp = {
  orderId: string;
  otp: string;
  agentId: string;
  ts: number;
};

function read(): QueuedOtp[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(items: QueuedOtp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX)));
  } catch {
    /* ignore quota */
  }
}

export function enqueue(item: QueuedOtp) {
  const items = read();
  items.push(item);
  write(items);
}

export function queueSize() {
  return read().length;
}

/** Try to verify every queued OTP. Removes entries on success or terminal failure. */
export async function flush(): Promise<{ verified: number }> {
  const items = read();
  if (items.length === 0) return { verified: 0 };

  const remaining: QueuedOtp[] = [];
  let verified = 0;

  for (const item of items) {
    try {
      const { data, error } = await supabase.rpc('verify_delivery_otp', {
        p_order_id: item.orderId,
        p_otp: item.otp,
        p_agent_id: item.agentId,
      });
      const result = data as any;
      if (!error && result?.success) {
        verified++;
        continue;
      }
      // Terminal failures (bad OTP, locked, already delivered) — don't retry.
      if (
        result?.locked ||
        result?.attempts_exceeded ||
        result?.expired ||
        typeof result?.attempts_remaining === 'number' ||
        (error && !/network|fetch|offline/i.test(error.message || ''))
      ) {
        continue;
      }
      remaining.push(item);
    } catch (e: any) {
      // Network error — keep for later.
      if (/network|fetch|offline/i.test(e?.message || '')) {
        remaining.push(item);
      }
    }
  }

  write(remaining);
  return { verified };
}
