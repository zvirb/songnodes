-- Rollback: drop unique index on gold_track_graph.track_id
DROP INDEX IF EXISTS public.idx_gold_track_graph_track_id_unique;
