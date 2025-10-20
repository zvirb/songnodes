-- Migration: add unique index on gold_track_graph.track_id to allow CONCURRENTLY refresh
-- Note: index must be non-partial and unique to enable REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_gold_track_graph_track_id_unique ON public.gold_track_graph (track_id);
