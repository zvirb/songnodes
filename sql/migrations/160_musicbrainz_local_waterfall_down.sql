-- Migration 160: Remove musicbrainz_local provider from the enrichment waterfall

DO $$ BEGIN
    IF to_regclass('metadata_enrichment_config') IS NOT NULL THEN

        -- Track Title
        UPDATE metadata_enrichment_config SET
            priority_2_provider = priority_3_provider, priority_2_confidence = priority_3_confidence,
            priority_3_provider = priority_4_provider, priority_3_confidence = priority_4_confidence,
            priority_4_provider = priority_5_provider, priority_4_confidence = priority_5_confidence,
            priority_5_provider = NULL, priority_5_confidence = NULL
        WHERE metadata_field = 'track_title' AND priority_2_provider = 'musicbrainz_local';

        -- Artist Name
        UPDATE metadata_enrichment_config SET
            priority_2_provider = priority_3_provider, priority_2_confidence = priority_3_confidence,
            priority_3_provider = priority_4_provider, priority_3_confidence = priority_4_confidence,
            priority_4_provider = priority_5_provider, priority_4_confidence = priority_5_confidence,
            priority_5_provider = NULL, priority_5_confidence = NULL
        WHERE metadata_field = 'artist_name' AND priority_2_provider = 'musicbrainz_local';

        -- Duration MS
        UPDATE metadata_enrichment_config SET
            priority_2_provider = priority_3_provider, priority_2_confidence = priority_3_confidence,
            priority_3_provider = NULL, priority_3_confidence = NULL
        WHERE metadata_field = 'duration_ms' AND priority_2_provider = 'musicbrainz_local';

        -- Release Date
        UPDATE metadata_enrichment_config SET
            priority_1_provider = priority_2_provider, priority_1_confidence = priority_2_confidence,
            priority_2_provider = priority_3_provider, priority_2_confidence = priority_3_confidence,
            priority_3_provider = priority_4_provider, priority_3_confidence = priority_4_confidence,
            priority_4_provider = priority_5_provider, priority_4_confidence = priority_5_confidence,
            priority_5_provider = NULL, priority_5_confidence = NULL
        WHERE metadata_field = 'release_date' AND priority_1_provider = 'musicbrainz_local';

        -- MusicBrainz ID
        UPDATE metadata_enrichment_config SET
            priority_1_provider = priority_2_provider, priority_1_confidence = priority_2_confidence,
            priority_2_provider = NULL, priority_2_confidence = NULL
        WHERE metadata_field = 'musicbrainz_id' AND priority_1_provider = 'musicbrainz_local';

        -- ISRC
        UPDATE metadata_enrichment_config SET
            priority_2_provider = priority_3_provider, priority_2_confidence = priority_3_confidence,
            priority_3_provider = NULL, priority_3_confidence = NULL
        WHERE metadata_field = 'isrc' AND priority_2_provider = 'musicbrainz_local';

    END IF;

    IF to_regclass('enrichment_providers') IS NOT NULL THEN
        DELETE FROM enrichment_providers WHERE provider_name = 'musicbrainz_local';
    END IF;
END $$;
