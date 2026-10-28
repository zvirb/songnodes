-- Migration 250_remove_beatport_api_key_requirement_up.sql
-- Remove Beatport row from api_key_requirements view

CREATE OR REPLACE VIEW api_key_requirements AS
SELECT
    'spotify' AS service_name,
    'client_id' AS key_name,
    'Spotify Client ID' AS display_name,
    'OAuth client ID from Spotify Developer Dashboard' AS description,
    TRUE AS required,
    'https://developer.spotify.com/dashboard' AS documentation_url,
    1 AS display_order
UNION ALL
SELECT
    'spotify', 'client_secret', 'Spotify Client Secret',
    'OAuth client secret from Spotify Developer Dashboard',
    TRUE, 'https://developer.spotify.com/dashboard', 2
UNION ALL
SELECT
    'discogs', 'token', 'Discogs Personal Access Token',
    'Personal access token from Discogs settings',
    TRUE, 'https://www.discogs.com/settings/developers', 3
UNION ALL
SELECT
    'lastfm', 'api_key', 'Last.fm API Key',
    'API key from Last.fm API account',
    FALSE, 'https://www.last.fm/api/account/create', 4
UNION ALL
SELECT
    'lastfm', 'shared_secret', 'Last.fm Shared Secret',
    'Shared secret from Last.fm API account (required for authenticated calls)',
    FALSE, 'https://www.last.fm/api/account/create', 5
UNION ALL
SELECT
    'musicbrainz', 'user_agent', 'MusicBrainz User-Agent',
    'User-Agent string for MusicBrainz API (format: AppName/Version)',
    TRUE, 'https://musicbrainz.org/doc/MusicBrainz_API', 6
UNION ALL
SELECT
    'youtube', 'api_key', 'YouTube Data API Key',
    'API key from Google Cloud Console for YouTube Data API',
    TRUE, 'https://console.cloud.google.com/apis/credentials', 7
UNION ALL
SELECT
    'setlistfm', 'api_key', 'Setlist.fm API Key',
    'API key for Setlist.fm scraper access',
    FALSE, 'https://api.setlist.fm/docs/1.0/index.html', 8
UNION ALL
SELECT
    'reddit', 'client_id', 'Reddit Client ID',
    'OAuth client ID from Reddit app settings',
    FALSE, 'https://www.reddit.com/prefs/apps', 9
UNION ALL
SELECT
    'reddit', 'client_secret', 'Reddit Client Secret',
    'OAuth client secret from Reddit app settings',
    FALSE, 'https://www.reddit.com/prefs/apps', 10
UNION ALL
SELECT
    '1001tracklists', 'username', '1001Tracklists Username',
    'Your 1001tracklists.com account username for authenticated scraping',
    TRUE, 'https://www.1001tracklists.com/register.php', 11
UNION ALL
SELECT
    '1001tracklists', 'password', '1001Tracklists Password',
    'Your 1001tracklists.com account password for authenticated scraping',
    TRUE, 'https://www.1001tracklists.com/register.php', 12
UNION ALL
SELECT
    'getsongbpm', 'api_key', 'GetSongBPM API Key',
    'Free API key from getsongbpm.com - provides BPM and key detection',
    FALSE, 'https://getsongbpm.com/api', 13;
