export type AnyCoord =
  | { latitude?: number; longitude?: number; lat?: number; lng?: number; lon?: number; x?: number; y?: number }
  | { type?: string; coordinates?: number[] }
  | number[]
  | string
  | null
  | undefined;

export type GeoPoint = { lat: number; lng: number };

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function clampLatLng(lat: number, lng: number): GeoPoint | null {
  if (!isFiniteNum(lat) || !isFiniteNum(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parsePoint(input: AnyCoord): GeoPoint | null {
  if (!input) return null;

  // GeoJSON { type:"Point", coordinates:[lng,lat] }
  if (typeof input === 'object' && 'type' in input && (input as any).type === 'Point' && Array.isArray((input as any).coordinates)) {
    const [lng, lat] = (input as any).coordinates as number[];
    return clampLatLng(lat, lng);
  }

  // Plain JSON with keys
  if (typeof input === 'object' && !Array.isArray(input)) {
    const o = input as Record<string, unknown>;
    const lat = (o.lat ?? o.latitude ?? o.y) as number | undefined;
    const lng = (o.lng ?? o.longitude ?? o.lon ?? o.x) as number | undefined;
    if (isFiniteNum(lat!) && isFiniteNum(lng!)) return clampLatLng(lat!, lng!);
  }

  // Array form — try to detect order
  if (Array.isArray(input) && input.length >= 2) {
    const a = Number(input[0]);
    const b = Number(input[1]);
    // Heuristic: whichever looks like latitude (|value| ≤ 90)
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return clampLatLng(a, b);      // [lat, lng]
    if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return clampLatLng(b, a);      // [lng, lat]
  }

  // Postgres point string "(lat,lng)" or "(lng,lat)"
  if (typeof input === 'string') {
    const m = input.match(/\(?\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*\)?/);
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[3]);
      if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return clampLatLng(a, b);
      if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return clampLatLng(b, a);
    }
    try {
      const json = JSON.parse(input);
      return parsePoint(json as any);
    } catch {}
  }

  return null;
}
