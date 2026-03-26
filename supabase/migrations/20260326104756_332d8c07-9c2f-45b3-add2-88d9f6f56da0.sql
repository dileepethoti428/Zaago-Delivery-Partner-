CREATE TABLE IF NOT EXISTS distance_cache (
  origin_lat numeric NOT NULL,
  origin_lng numeric NOT NULL,
  dest_lat numeric NOT NULL,
  dest_lng numeric NOT NULL,
  distance_km numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (origin_lat, origin_lng, dest_lat, dest_lng)
);

CREATE INDEX IF NOT EXISTS idx_distance_cache_coords 
ON distance_cache(origin_lat, origin_lng, dest_lat, dest_lng);

ALTER TABLE distance_cache ENABLE ROW LEVEL SECURITY;