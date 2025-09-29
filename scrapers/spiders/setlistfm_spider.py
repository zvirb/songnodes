"""
Setlist.fm API Spider
Uses the official Setlist.fm API v1.0 to collect live performance data
"""

import scrapy
import json
import os
import re
import hashlib
from datetime import datetime
from urllib.parse import quote
import redis
import requests
from urllib import robotparser
from scrapy.exceptions import CloseSpider
try:
    from ..items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem, EnhancedTrackAdjacencyItem, PlaylistItem
except ImportError:
    # Fallback for standalone execution
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import SetlistItem, TrackItem, TrackArtistItem, SetlistTrackItem, EnhancedTrackAdjacencyItem, PlaylistItem

class SetlistFmSpider(scrapy.Spider):
    name = 'setlistfm'
    allowed_domains = ['api.setlist.fm']

    custom_settings = {
        'DOWNLOAD_DELAY': 0.1,  # 10 requests per second max
        'CONCURRENT_REQUESTS': 1,
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'application/json',
            'x-api-key': os.environ.get('SETLISTFM_API_KEY', '')
        }
    }

    def __init__(self, artist_name=None, venue=None, city=None, *args, **kwargs):
        force_run_arg = kwargs.pop('force_run', None)
        super().__init__(*args, **kwargs)

        # Build search URL based on parameters
        base_url = 'https://api.setlist.fm/rest/1.0/search/setlists'
        params = []

        self.redis_client = None
        self.redis_prefix = os.getenv('SCRAPER_STATE_PREFIX_SETLISTFM', 'scraped:setlists:setlistfm')
        self.source_ttl_seconds = int(os.getenv('SCRAPER_SOURCE_TTL_DAYS', '30')) * 86400
        self.run_ttl_seconds = int(os.getenv('SCRAPER_RUN_TTL_HOURS', '24')) * 3600
        self.last_run_key = None
        self.force_run = (
            force_run_arg
            if force_run_arg is not None
            else os.getenv('SCRAPER_FORCE_RUN', '0').lower() in ('1', 'true', 'yes')
        )
        self.initialize_state_store()

        if artist_name:
            params.append(f'artistName={quote(artist_name)}')
        if venue:
            params.append(f'venueName={quote(venue)}')
        if city:
            params.append(f'cityName={quote(city)}')

        self.apply_robots_policy()

        # Default to contemporary electronic artists (rotation-aware)
        if not params:
            target_artists = self.load_target_artists()
            artist_batch = self.select_artist_batch(target_artists)
            year_batch = self.select_year_batch()

            self.start_urls = []
            for artist in artist_batch:
                encoded_artist = quote(artist)
                for year in year_batch:
                    self.start_urls.append(
                        f'{base_url}?artistName={encoded_artist}&year={year}'
                    )
        else:
            self.start_urls = [f"{base_url}?{'&'.join(params)}"]

        self.logger.info(f"Initialized with URLs: {self.start_urls}")

    def load_target_artists(self):
        """Load popular and emerging artists from the shared target list."""
        target_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'target_tracks_for_scraping.json'
        )

        artist_set = set()

        try:
            if os.path.exists(target_file):
                with open(target_file, 'r') as f:
                    target_data = json.load(f)

                for section in ('priority_tracks', 'all_tracks'):
                    for track in target_data.get('scraper_targets', {}).get(section, []):
                        primary = track.get('primary_artist')
                        if primary:
                            artist_set.add(primary)
                        for artist in track.get('artists', []) or []:
                            artist_set.add(artist)

            if not artist_set:
                raise ValueError("No artists loaded from target list")

            return sorted(artist_set)

        except Exception as exc:
            self.logger.warning(
                "Falling back to default Setlist.fm artist list: %s",
                exc
            )
            return [
                'FISHER', 'Fred again..', 'Anyma', 'Swedish House Mafia',
                'Calvin Harris', 'David Guetta', 'Martin Garrix', 'Alok',
                'Chris Lake', 'John Summit', 'Dom Dolla', 'Skrillex',
                'Marshmello', 'Tiësto', 'Eric Prydz', 'Deadmau5'
            ]

    def select_artist_batch(self, artists):
        """Rotate through artists without exceeding API quotas."""
        total = len(artists)
        if total == 0:
            return []

        batch_size = int(os.getenv('SETLISTFM_ARTIST_BATCH_SIZE', 12))
        rotation_seed_raw = os.getenv('SETLISTFM_ARTIST_ROTATION')

        if rotation_seed_raw is not None:
            try:
                rotation_seed = int(rotation_seed_raw)
            except ValueError:
                self.logger.warning(
                    "Invalid SETLISTFM_ARTIST_ROTATION value '%s'; defaulting to date-based rotation",
                    rotation_seed_raw
                )
                rotation_seed = datetime.utcnow().toordinal()
        else:
            rotation_seed = datetime.utcnow().toordinal()

        start_index = (rotation_seed * batch_size) % total
        window = min(batch_size, total)
        return [artists[(start_index + i) % total] for i in range(window)]

    def select_year_batch(self):
        """Return a bounded list of years to query per artist."""
        configured = os.getenv('SETLISTFM_YEAR_RANGE')
        if configured:
            try:
                years = [year.strip() for year in configured.split(',') if year.strip()]
                return years or [str(datetime.utcnow().year)]
            except Exception:
                self.logger.warning("Invalid SETLISTFM_YEAR_RANGE, defaulting to recent years")

        current_year = datetime.utcnow().year
        span = int(os.getenv('SETLISTFM_YEAR_SPAN', 3))
        return [str(current_year - offset) for offset in range(span)]

    def apply_robots_policy(self):
        """Apply robots.txt policy with proper error handling and timeout."""
        # Skip robots.txt check if disabled
        if os.getenv('SKIP_ROBOTS_CHECK', 'false').lower() in ('true', '1', 'yes'):
            self.logger.debug("Skipping robots.txt check (disabled)")
            self.custom_settings['DOWNLOAD_DELAY'] = 0.5
            return

        robots_url = os.getenv('SETLISTFM_ROBOTS_URL', 'https://api.setlist.fm/robots.txt')
        user_agent = self.custom_settings.get('USER_AGENT', 'Mozilla/5.0')
        parser = robotparser.RobotFileParser()

        try:
            # Use a very short timeout to prevent blocking
            response = requests.get(robots_url, timeout=1)
            if response.status_code != 200:
                self.logger.debug("Setlist.fm robots.txt returned status %s", response.status_code)
                # Use default delay if robots.txt is unavailable
                self.custom_settings['DOWNLOAD_DELAY'] = 0.5
                return
            parser.parse(response.text.splitlines())
            delay = parser.crawl_delay(user_agent) or parser.crawl_delay('*')
            if delay:
                delay = float(delay)
                # Cap the delay at a reasonable maximum to prevent slowdowns
                delay = min(delay, 2.0)
                current_delay = self.custom_settings.get('DOWNLOAD_DELAY', getattr(self, 'download_delay', 0.1))
                if delay > current_delay:
                    self.download_delay = delay
                    self.custom_settings['DOWNLOAD_DELAY'] = delay
                    self.logger.info("Applied Setlist.fm robots.txt crawl-delay of %s seconds", delay)
        except requests.exceptions.Timeout:
            self.logger.warning("Timeout fetching robots.txt, using default delay of 0.5s")
            self.custom_settings['DOWNLOAD_DELAY'] = 0.5
        except requests.exceptions.RequestException as exc:
            self.logger.warning("Failed to fetch robots.txt: %s, using default delay", exc)
            self.custom_settings['DOWNLOAD_DELAY'] = 0.5
        except Exception as exc:
            self.logger.debug("Failed to apply Setlist.fm robots policy: %s, using default delay", exc)
            self.custom_settings['DOWNLOAD_DELAY'] = 0.5

    def initialize_state_store(self):
        host = os.getenv('SCRAPER_STATE_REDIS_HOST', os.getenv('REDIS_HOST', 'localhost'))
        port = int(os.getenv('SCRAPER_STATE_REDIS_PORT', os.getenv('REDIS_PORT', 6379)))
        db = int(os.getenv('SCRAPER_STATE_REDIS_DB', os.getenv('REDIS_DB', 0)))

        try:
            client = redis.Redis(host=host, port=port, db=db, decode_responses=True, socket_timeout=2)
            client.ping()
            self.redis_client = client
            self.logger.info(
                "Using Redis state store at %s:%s db %s for Setlist.fm dedupe",
                host,
                port,
                db
            )
            self.enforce_run_quota()
        except Exception as exc:
            self.redis_client = None
            self.logger.warning("Redis state store unavailable for Setlist.fm (%s)", exc)

    def enforce_run_quota(self):
        if not self.redis_client:
            return
        self.last_run_key = f"{self.redis_prefix}:last_run"
        if self.force_run:
            return
        last_run = self.redis_client.get(self.last_run_key)
        if last_run:
            self.logger.warning("Daily quota already used for Setlist.fm (last run at %s)", last_run)
            raise CloseSpider('daily_quota_reached')

    def parse(self, response):
        """Parse search results"""
        try:
            data = json.loads(response.text)

            # Process each setlist
            for setlist in data.get('setlist', []):
                setlist_id = setlist.get('id')
                if self.is_source_processed(setlist_id):
                    continue

                # Create venue item
                venue_data = setlist.get('venue', {})
                city_data = venue_data.get('city', {})

                venue_item = {
                    'id': venue_data.get('id'),
                    'name': venue_data.get('name'),
                    'city': city_data.get('name'),
                    'state': city_data.get('stateCode'),
                    'country': city_data.get('country', {}).get('name'),
                    'latitude': city_data.get('coords', {}).get('lat'),
                    'longitude': city_data.get('coords', {}).get('long')
                }

                # Create event item
                artist_data = setlist.get('artist', {})
                event_date = setlist.get('eventDate')

                event_item = {
                    'id': setlist.get('id'),
                    'name': setlist.get('tour', {}).get('name') or f"{artist_data.get('name')} Live",
                    'date': event_date,
                    'venue_id': venue_data.get('id'),
                    'artist_id': artist_data.get('mbid'),
                    'artist_name': artist_data.get('name')
                }

                # Create setlist item
                setlist_item = SetlistItem()
                setlist_item['setlist_name'] = f"{artist_data.get('name')} - {event_date} - {venue_data.get('name')}"
                setlist_item['dj_artist_name'] = artist_data.get('name')
                setlist_item['event_name'] = setlist.get('tour', {}).get('name')
                setlist_item['venue_name'] = venue_data.get('name')
                setlist_item['set_date'] = event_date
                setlist_item['last_updated_date'] = None

                yield setlist_item

                # Process tracks in the setlist
                sets = setlist.get('sets', {}).get('set', [])
                track_position = 1
                tracks_data = []  # Collect tracks for adjacency generation
                track_names = []  # Collect track names for playlist item

                for set_data in sets:
                    for song in set_data.get('song', []):
                        name = song.get('name') or ''
                        track_names.append(name)  # Collect track name for playlist item
                        track_item = TrackItem()
                        track_item['track_name'] = name
                        track_item['is_remix'] = bool(re.search(r'(remix|edit|mix)\b', name, re.IGNORECASE))
                        track_item['is_mashup'] = bool(re.search(r'\b(vs\.|mashup)\b', name, re.IGNORECASE))
                        track_item['mashup_components'] = []
                        track_item['track_type'] = 'Setlist'

                        # Check if it's a cover
                        if song.get('cover'):
                            track_item['is_cover'] = True

                        yield track_item

                        # Yield track artist relationship
                        track_artist_item = TrackArtistItem()
                        track_artist_item['track_name'] = name
                        track_artist_item['artist_name'] = artist_data.get('name')
                        track_artist_item['artist_role'] = 'primary'
                        yield track_artist_item

                        # Yield setlist track relationship
                        setlist_track_item = SetlistTrackItem()
                        setlist_track_item['setlist_name'] = setlist_item['setlist_name']
                        setlist_track_item['track_name'] = name
                        setlist_track_item['track_order'] = track_position
                        setlist_track_item['start_time'] = None
                        yield setlist_track_item

                        # Collect track data for adjacency generation
                        tracks_data.append({
                            'track': {'track_name': name, 'track_id': None},
                            'track_order': track_position
                        })

                        track_position += 1

                # CRITICAL: Create and yield playlist item FIRST, before adjacencies
                if track_names:
                    playlist_item = self.create_playlist_item_from_setlist(setlist_item, track_names)
                    if playlist_item:
                        self.logger.info(f"Yielding playlist item: {playlist_item.get('name')} with {len(track_names)} tracks")
                        yield playlist_item

                # Generate track adjacency relationships within THIS setlist only
                if len(tracks_data) > 1:
                    yield from self.generate_track_adjacencies(tracks_data, setlist_item)

                self.logger.info(f"Processed setlist: {setlist_item['setlist_name']}")
                self.mark_source_processed(setlist_id)

            # Handle pagination
            total_setlists = data.get('total', 0)
            current_page = data.get('page', 1)
            items_per_page = data.get('itemsPerPage', 20)

            if current_page * items_per_page < total_setlists:
                next_page = current_page + 1
                next_url = f"{response.url.split('&p=')[0]}&p={next_page}"
                yield scrapy.Request(next_url, callback=self.parse)

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
        except Exception as e:
            self.logger.error(f"Error processing setlist data: {e}")

    def parse_artist_setlists(self, response):
        """Parse setlists for a specific artist"""
        return self.parse(response)

    def is_source_processed(self, identifier: str) -> bool:
        if not identifier:
            return False
        if not self.redis_client:
            return False
        key = f"{self.redis_prefix}:{identifier}"
        try:
            return bool(self.redis_client.exists(key))
        except Exception as exc:
            self.logger.debug("Redis exists check failed for Setlist.fm: %s", exc)
            return False

    def mark_source_processed(self, identifier: str) -> None:
        if not identifier or not self.redis_client:
            return
        key = f"{self.redis_prefix}:{identifier}"
        try:
            self.redis_client.setex(key, self.source_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed for Setlist.fm: %s", exc)

    def generate_track_adjacencies(self, tracks_data, setlist_data):
        """
        Generate track adjacency relationships within a single setlist.
        Creates adjacency items for tracks within 3 positions of each other.
        """
        if not tracks_data or len(tracks_data) < 2:
            return

        setlist_name = setlist_data.get('setlist_name', 'Unknown Setlist')
        setlist_id = f"setlistfm_{hash(setlist_name)}"

        # Sort tracks by their order to ensure proper adjacency
        sorted_tracks = sorted(tracks_data, key=lambda x: x.get('track_order', 0))

        adjacency_count = 0
        for i in range(len(sorted_tracks)):
            for j in range(i + 1, min(i + 4, len(sorted_tracks))):  # Within 3 positions
                track_1 = sorted_tracks[i]
                track_2 = sorted_tracks[j]

                # Calculate distance between tracks
                distance = abs(track_1.get('track_order', 0) - track_2.get('track_order', 0))

                # Determine transition type based on distance
                if distance == 1:
                    transition_type = "sequential"
                elif distance <= 3:
                    transition_type = "close_proximity"
                else:
                    continue  # Skip if too far apart

                # Create adjacency item
                adjacency_item = EnhancedTrackAdjacencyItem(
                    track_1_name=track_1['track']['track_name'],
                    track_1_id=track_1['track'].get('track_id'),
                    track_2_name=track_2['track']['track_name'],
                    track_2_id=track_2['track'].get('track_id'),
                    track_1_position=track_1.get('track_order'),
                    track_2_position=track_2.get('track_order'),
                    distance=distance,
                    setlist_name=setlist_name,
                    setlist_id=setlist_id,
                    source_context=f"setlistfm:{setlist_name}",
                    transition_type=transition_type,
                    occurrence_count=1,
                    created_at=datetime.utcnow(),
                    data_source=self.name,
                    scrape_timestamp=datetime.utcnow()
                )

                yield adjacency_item
                adjacency_count += 1

        if adjacency_count > 0:
            self.logger.info(f"Generated {adjacency_count} track adjacency relationships for setlist: {setlist_name}")

    def create_playlist_item_from_setlist(self, setlist_item, track_names):
        """Create a PlaylistItem from setlist metadata for database storage"""
        try:
            playlist_item = PlaylistItem(
                item_type='playlist',
                name=setlist_item.get('setlist_name'),
                source='setlistfm',
                source_url=setlist_item.get('source_url', ''),
                dj_name=setlist_item.get('dj_artist_name'),
                artist_name=setlist_item.get('dj_artist_name'),
                curator=setlist_item.get('dj_artist_name'),
                event_name=setlist_item.get('event_name'),
                event_date=setlist_item.get('set_date'),
                venue_name=setlist_item.get('venue_name'),
                tracks=track_names,  # List of track names
                total_tracks=len(track_names) if track_names else 0,
                description=None,
                genre_tags=None,
                duration_minutes=None,
                bpm_range=None,
                data_source=self.name,
                scrape_timestamp=datetime.utcnow(),
                created_at=datetime.utcnow()
            )

            self.logger.debug(f"Created playlist item: {setlist_item.get('setlist_name')}")
            return playlist_item

        except Exception as e:
            self.logger.error(f"Error creating playlist item: {e}")
            return None

    def closed(self, reason):
        self.record_run_timestamp()

    def record_run_timestamp(self):
        if not self.redis_client or not self.last_run_key:
            return
        try:
            self.redis_client.setex(self.last_run_key, self.run_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed for Setlist.fm last run tracking: %s", exc)
