-- Migration 160: Add musicbrainz_local provider to the enrichment waterfall
-- Blueprint Section 5: Metadata-Driven Re-Enrichment (WP4/WP5)

DO $$ BEGIN
    IF to_regclass('enrichment_providers') IS NOT NULL THEN
        INSERT INTO enrichment_providers (provider_name, provider_type, supported_fields, requires_auth, auth_type)
        VALUES ('musicbrainz_local', 'database', ARRAY['musicbrainz_id', 'isrc', 'release_date', 'artist_name', 'track_title'], FALSE, NULL)
        ON CONFLICT (provider_name) DO NOTHING;
    END IF;

    IF to_regclass('metadata_enrichment_config') IS NOT NULL THEN
        -- Insert musicbrainz_local in front of musicbrainz where applicable

        -- ISRC
        UPDATE metadata_enrichment_config SET
            priority_3_provider = priority_2_provider, priority_3_confidence = priority_2_confidence,
            priority_2_provider = 'musicbrainz_local', priority_2_confidence = 0.90
        WHERE metadata_field = 'isrc' AND priority_2_provider = 'musicbrainz';

        -- MusicBrainz ID
        UPDATE metadata_enrichment_config SET
            priority_2_provider = priority_1_provider, priority_2_confidence = priority_1_confidence,
            priority_1_provider = 'musicbrainz_local', priority_1_confidence = 1.00
        WHERE metadata_field = 'musicbrainz_id' AND priority_1_provider = 'musicbrainz';

        -- Release Date
        UPDATE metadata_enrichment_config SET
            priority_5_provider = priority_4_provider, priority_5_confidence = priority_4_confidence,
            priority_4_provider = priority_3_provider, priority_4_confidence = priority_3_confidence,
            priority_3_provider = priority_2_provider, priority_3_confidence = priority_2_confidence,
            priority_2_provider = priority_1_provider, priority_2_confidence = priority_1_confidence,
            priority_1_provider = 'musicbrainz_local', priority_1_confidence = 0.90
        WHERE metadata_field = 'release_date' AND priority_1_provider = 'musicbrainz';

        -- Duration MS
        UPDATE metadata_enrichment_config SET
            priority_3_provider = priority_2_provider, priority_3_confidence = priority_2_confidence,
            priority_2_provider = 'musicbrainz_local', priority_2_confidence = 0.85
        WHERE metadata_field = 'duration_ms' AND priority_2_provider = 'musicbrainz';

        -- Artist Name
        UPDATE metadata_enrichment_config SET
            priority_5_provider = priority_4_provider, priority_5_confidence = priority_4_confidence,
            priority_4_provider = priority_3_provider, priority_4_confidence = priority_3_confidence,
            priority_3_provider = priority_2_provider, priority_3_confidence = priority_2_confidence,
            priority_2_provider = 'musicbrainz_local', priority_2_confidence = 0.90
        WHERE metadata_field = 'artist_name' AND priority_2_provider = 'musicbrainz';

        -- Track Title
        UPDATE metadata_enrichment_config SET
            priority_5_provider = priority_4_provider, priority_5_confidence = priority_4_confidence,
            priority_4_provider = priority_3_provider, priority_4_confidence = priority_3_confidence,
            priority_3_provider = priority_2_provider, priority_3_confidence = priority_2_confidence,
            priority_2_provider = 'musicbrainz_local', priority_2_confidence = 0.90
        WHERE metadata_field = 'track_title' AND priority_2_provider = 'musicbrainz';

    END IF;
END $$;
