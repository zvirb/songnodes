"""
Reddit Monitor Spider - Tier 3 Community-Driven Track Identification
=====================================================================

Monitors Reddit communities for early track identification - the "latency advantage" source.
Captures track IDs hours/days before they appear on aggregators like 1001tracklists.

Target Communities (Organized by Purpose):
--------------------------------------------
ID Requests:
- r/IdentifyThisTrack - Direct track identification requests
- r/NameThatSong - Song identification requests
- r/tipofmytongue - General identification requests

Genre-Specific:
- r/Techno - Techno music discoveries
- r/hardstyle - Hardstyle music discoveries
- r/Trance - Trance music discoveries
- r/DnB - Drum and Bass music discoveries
- r/House - House music discoveries (strict "Artist - Title" format)
- r/tech_house - Tech House music discoveries

Tracklists & General:
- r/tracklists - Setlist sharing
- r/EDM - Electronic Dance Music
- r/electronicmusic - General electronic music

DJ Community:
- r/Beatmatch - DJ learning and track recommendations
- r/DJs - Professional DJ discussions and track sharing

Festivals:
- r/electricdaisycarnival - EDC festival content
- r/Tomorrowland - Tomorrowland festival content
- r/Ultra - Ultra Music Festival content
- r/festivals - General festival discussions

Post Classification:
--------------------
- track_id_request: "What is this track?" posts
- track_id_provided: Successful identification in comments
- mix_share: DJ mixes with tracklists
- discussion: General track discussions

Features:
---------
- Automatic genre tagging based on subreddit (e.g., r/Techno → "Techno")
- Enhanced "Artist - Title" parsing for r/House strict format
- Configurable subreddit filtering via command-line arguments
- NLP fallback for complex tracklist extraction
- Redis-based deduplication to avoid reprocessing

Rate Limiting: 60 requests/minute (Reddit API standard)
"""

import scrapy
try:
    import praw
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False
    print("⚠️ Warning: praw not installed - reddit_monitor_spider will not be functional")

import redis
import json
import os
import hashlib
import re
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
import logging

try:
    from ..items import (
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        PlaylistItem
    )
    from ..nlp_spider_mixin import NLPFallbackSpiderMixin
    from ..track_id_generator import generate_track_id
except ImportError:
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import (
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        PlaylistItem
    )
    from nlp_spider_mixin import NLPFallbackSpiderMixin
    from track_id_generator import generate_track_id


class RedditMonitorSpider(NLPFallbackSpiderMixin, scrapy.Spider):
    """
    Advanced Reddit monitoring spider for community-driven track identification.
    Uses PRAW for efficient API access and NLP for intelligent text parsing.
    """

    name = 'reddit_monitor'
    allowed_domains = ['reddit.com']

    # Respectful rate limiting for Reddit API
    custom_settings = {
        'DOWNLOAD_DELAY': 1.0,  # 1 second between requests = 60 req/min
        'RANDOMIZE_DOWNLOAD_DELAY': 0.2,
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'ROBOTSTXT_OBEY': True,
        'USER_AGENT': 'SongNodes/2.0 Music Discovery Bot (by /u/songnodes_bot)',
        'ITEM_PIPELINES': {
            'pipelines.raw_data_storage_pipeline.RawDataStoragePipeline': 50,  # Raw data archive
            'pipelines.validation_pipeline.ValidationPipeline': 100,  # Validation
            'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,  # Enrichment
            'pipelines.persistence_pipeline.PersistencePipeline': 300,  # Modern async persistence
        }
    }

    # Target subreddits organized by purpose
    SUBREDDITS = {
        'id_requests': ['IdentifyThisTrack', 'NameThatSong', 'tipofmytongue'],
        'genre_specific': ['Techno', 'hardstyle', 'Trance', 'DnB', 'House', 'tech_house'],
        'tracklists': ['tracklists', 'EDM', 'electronicmusic'],
        'festivals': ['electricdaisycarnival', 'Tomorrowland', 'Ultra', 'festivals'],
        'dj_community': ['Beatmatch', 'DJs']  # DJ community for track recommendations
    }

    # Genre mapping for subreddit-specific tagging
    SUBREDDIT_GENRE_MAP = {
        'Techno': 'Techno',
        'hardstyle': 'Hardstyle',
        'Trance': 'Trance',
        'DnB': 'Drum and Bass',
        'House': 'House',
        'tech_house': 'Tech House',
        'Beatmatch': 'Various',
        'DJs': 'Various',
        'electronicmusic': 'Electronic',
        'EDM': 'Electronic Dance Music'
    }

    # Keywords for classification
    ID_REQUEST_KEYWORDS = [
        'id', 'identify', 'what is this', 'track name', 'song name',
        'find this', 'anyone know', 'help me find', 'looking for'
    ]

    TRACKLIST_KEYWORDS = [
        'tracklist', 'setlist', 'playlist', 'full set', 'tracklisting',
        'track list', 'set list', 'play list'
    ]

    def __init__(self, subreddit_filter=None, time_filter='day', *args, **kwargs):
        """
        Initialize Reddit Monitor Spider

        Args:
            subreddit_filter: Comma-separated list of subreddits to monitor (optional)
            time_filter: Time range for posts ('hour', 'day', 'week', 'month')
        """
        super(RedditMonitorSpider, self).__init__(*args, **kwargs)

        self.time_filter = time_filter
        self.processed_posts = set()
        self.redis_client = None
        self.redis_prefix = 'scraped:reddit:posts'
        self.praw_client = None

        # Filter subreddits if specified
        if subreddit_filter:
            filtered_subs = [s.strip() for s in subreddit_filter.split(',')]
            self.target_subreddits = filtered_subs
        else:
            # Use all configured subreddits
            self.target_subreddits = []
            for category_subs in self.SUBREDDITS.values():
                self.target_subreddits.extend(category_subs)

        # Statistics tracking
        self.stats = {
            'posts_processed': 0,
            'track_ids_found': 0,
            'tracklists_found': 0,
            'id_requests_found': 0
        }

        # Initialize PRAW and Redis
        self.initialize_praw()
        self.initialize_redis()

        # Generate start URLs (dummy URLs since we use PRAW for actual scraping)
        self.start_urls = ['https://reddit.com']  # Placeholder for Scrapy

    def initialize_praw(self):
        """Initialize PRAW (Python Reddit API Wrapper) client"""
        try:
            # Load credentials from environment or database
            client_id = os.getenv('REDDIT_CLIENT_ID')
            client_secret = os.getenv('REDDIT_CLIENT_SECRET')
            user_agent = self.custom_settings.get('USER_AGENT')

            if not client_id or not client_secret:
                self.logger.warning("Reddit API credentials not found. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET")
                self.praw_client = None
                return

            self.praw_client = praw.Reddit(
                client_id=client_id,
                client_secret=client_secret,
                user_agent=user_agent,
                check_for_async=False  # Using sync PRAW
            )

            # Test authentication
            self.praw_client.user.me()  # Will raise exception if auth fails
            self.logger.info(f"✓ PRAW authenticated successfully")

        except Exception as e:
            self.logger.error(f"PRAW initialization failed: {e}")
            self.praw_client = None

    def initialize_redis(self):
        """Initialize Redis for deduplication"""
        host = os.getenv('SCRAPER_STATE_REDIS_HOST', os.getenv('REDIS_HOST', 'redis'))
        port = int(os.getenv('SCRAPER_STATE_REDIS_PORT', os.getenv('REDIS_PORT', 6379)))
        db = int(os.getenv('SCRAPER_STATE_REDIS_DB', 0))

        try:
            self.redis_client = redis.Redis(
                host=host,
                port=port,
                db=db,
                decode_responses=True,
                socket_timeout=2
            )
            self.redis_client.ping()
            self.logger.info(f"✓ Redis connected at {host}:{port}")
        except Exception as e:
            self.logger.warning(f"Redis unavailable: {e}. Continuing without deduplication.")
            self.redis_client = None

    def start(self):
        """
        Override start_requests to use PRAW instead of traditional scraping.
        This is more efficient and respects Reddit's API design.
        """
        if not self.praw_client:
            self.logger.error("PRAW not initialized. Cannot start Reddit monitoring.")
            return

        for subreddit_name in self.target_subreddits:
            try:
                # Yield a dummy request that triggers our PRAW processing
                yield scrapy.Request(
                    url=f'https://reddit.com/r/{subreddit_name}',
                    callback=self.process_subreddit_via_praw,
                    meta={'subreddit': subreddit_name},
                    dont_filter=True
                )
            except Exception as e:
                self.logger.error(f"Error creating request for r/{subreddit_name}: {e}")

    def process_subreddit_via_praw(self, response):
        """
        Process subreddit using PRAW API (bypasses traditional scraping).
        This method is called for each subreddit.
        """
        subreddit_name = response.meta.get('subreddit')

        try:
            subreddit = self.praw_client.subreddit(subreddit_name)
            self.logger.info(f"🔍 Monitoring r/{subreddit_name} for new posts...")

            # Fetch recent posts based on time filter
            if self.time_filter == 'hour':
                posts = subreddit.new(limit=50)
            elif self.time_filter == 'day':
                posts = subreddit.hot(limit=100)
            elif self.time_filter == 'week':
                posts = subreddit.top(time_filter='week', limit=100)
            else:
                posts = subreddit.hot(limit=100)

            for post in posts:
                # Check if already processed
                if self.is_post_processed(post.id):
                    continue

                # Classify and process post
                post_classification = self.classify_post(post)

                if post_classification['relevant']:
                    yield from self.process_relevant_post(post, post_classification)

                # Mark as processed
                self.mark_post_processed(post.id)
                self.stats['posts_processed'] += 1

            self.logger.info(
                f"✓ r/{subreddit_name}: Processed {self.stats['posts_processed']} posts, "
                f"Found {self.stats['track_ids_found']} track IDs"
            )

        except Exception as e:
            self.logger.error(f"Error processing r/{subreddit_name}: {e}")

    def classify_post(self, post) -> Dict[str, any]:
        """
        Classify Reddit post by type and relevance.

        Returns:
            Dict with classification results:
            - relevant: bool
            - post_type: str ('track_id_request', 'track_id_provided', 'mix_share', 'discussion')
            - confidence: float (0-1)
        """
        title_lower = post.title.lower()
        selftext_lower = post.selftext.lower() if post.selftext else ''
        combined_text = title_lower + ' ' + selftext_lower

        classification = {
            'relevant': False,
            'post_type': 'unknown',
            'confidence': 0.0
        }

        # Check for track ID requests
        id_request_score = sum(1 for kw in self.ID_REQUEST_KEYWORDS if kw in combined_text)
        if id_request_score >= 2:
            classification['relevant'] = True
            classification['post_type'] = 'track_id_request'
            classification['confidence'] = min(id_request_score / 5.0, 1.0)
            return classification

        # Check for tracklist sharing
        tracklist_score = sum(1 for kw in self.TRACKLIST_KEYWORDS if kw in combined_text)
        if tracklist_score >= 1:
            classification['relevant'] = True
            classification['post_type'] = 'mix_share'
            classification['confidence'] = min(tracklist_score / 3.0, 1.0)
            return classification

        # Check if post has media (SoundCloud, YouTube, Mixcloud links)
        media_platforms = ['soundcloud.com', 'youtube.com', 'youtu.be', 'mixcloud.com', 'spotify.com']
        if any(platform in combined_text for platform in media_platforms):
            classification['relevant'] = True
            classification['post_type'] = 'discussion'
            classification['confidence'] = 0.6
            return classification

        return classification

    def process_relevant_post(self, post, classification):
        """
        Process a relevant post and extract track information.
        Uses NLP fallback for intelligent text parsing.
        """
        post_type = classification['post_type']

        self.logger.info(
            f"📌 Processing {post_type} post: '{post.title}' "
            f"(confidence: {classification['confidence']:.2f})"
        )

        # Extract subreddit name for genre tagging
        subreddit_name = post.subreddit.display_name

        if post_type == 'track_id_request':
            # Check comments for successful identifications
            yield from self.extract_track_ids_from_comments(post, subreddit_name)

        elif post_type == 'mix_share':
            # Extract tracklist from post body and comments
            yield from self.extract_tracklist(post, subreddit_name)

        elif post_type == 'discussion':
            # Extract any track mentions
            yield from self.extract_track_mentions(post, subreddit_name)

    def extract_track_ids_from_comments(self, post, subreddit_name):
        """
        Scan comments for successful track identifications.
        Pattern: User asks "What's this track?" -> Someone replies "Artist - Title"
        """
        try:
            # Expand all comment trees
            post.comments.replace_more(limit=3)  # Limit to avoid API abuse

            for comment in post.comments.list()[:30]:  # Check top 30 comments
                comment_text = comment.body

                # Look for "Artist - Title" pattern
                tracks = self.parse_artist_title_format(comment_text)

                if tracks:
                    self.logger.info(f"✓ Found track ID in comment: {tracks[0]}")

                    for track_info in tracks:
                        yield self.create_track_item(
                            track_info,
                            source_url=f"https://reddit.com{post.permalink}",
                            context=f"Reddit ID Request: {post.title}",
                            subreddit=subreddit_name
                        )
                        self.stats['track_ids_found'] += 1

        except Exception as e:
            self.logger.error(f"Error extracting track IDs from comments: {e}")

    def extract_tracklist(self, post, subreddit_name):
        """
        Extract complete tracklist from post body.
        Uses NLP fallback for intelligent parsing.
        """
        try:
            # Combine title and body for NLP processing
            text_content = f"{post.title}\n\n{post.selftext}"

            # Try NLP extraction first
            if self.enable_nlp_fallback and len(text_content) > 100:
                tracks = self.extract_via_nlp_sync(
                    html_or_text=text_content,
                    url=f"https://reddit.com{post.permalink}",
                    extract_timestamps=True
                )

                if tracks and len(tracks) >= 3:
                    self.logger.info(f"✓ NLP extracted {len(tracks)} tracks from tracklist post")

                    # Create setlist/playlist item
                    playlist_item = self.create_playlist_from_reddit(post, tracks, subreddit_name)
                    if playlist_item:
                        yield playlist_item

                    # Yield individual tracks
                    for track_data in tracks:
                        yield self.create_track_item(
                            {
                                'artist': track_data.get('artist_name', 'Unknown'),
                                'title': track_data.get('track_name', 'Unknown'),
                                'timestamp': track_data.get('start_time')
                            },
                            source_url=f"https://reddit.com{post.permalink}",
                            context=f"Reddit Tracklist: {post.title}",
                            subreddit=subreddit_name
                        )
                        self.stats['track_ids_found'] += 1

                    self.stats['tracklists_found'] += 1
                    return

            # Fallback to regex parsing
            tracks = self.parse_tracklist_format(text_content)
            if tracks:
                self.logger.info(f"✓ Regex extracted {len(tracks)} tracks from tracklist")
                for track_info in tracks:
                    yield self.create_track_item(
                        track_info,
                        source_url=f"https://reddit.com{post.permalink}",
                        context=f"Reddit Tracklist: {post.title}",
                        subreddit=subreddit_name
                    )
                    self.stats['track_ids_found'] += 1

        except Exception as e:
            self.logger.error(f"Error extracting tracklist: {e}")

    def extract_track_mentions(self, post, subreddit_name):
        """Extract any track mentions from discussion posts"""
        text_content = f"{post.title}\n{post.selftext}"
        tracks = self.parse_artist_title_format(text_content)

        for track_info in tracks:
            yield self.create_track_item(
                track_info,
                source_url=f"https://reddit.com{post.permalink}",
                context=f"Reddit Discussion: {post.title}",
                subreddit=subreddit_name
            )

    def parse_artist_title_format(self, text: str) -> List[Dict]:
        """
        Parse "Artist - Title" format from text.
        Handles various formats with enhanced detection for strict r/House format:
        - Artist - Title (strict format, common in r/House)
        - Artist — Title (em-dash variant)
        - "Title" by Artist
        - Artist: Title
        - [Label] Artist - Title (with label prefix)
        """
        tracks = []

        patterns = [
            # Strict r/House format: Artist - Title (must start with capital letter, no numbers before)
            r'(?:^|[\n\r])\s*([A-Z][A-Za-z0-9\s&\.\'\-]+?)\s*[-–—]\s*([A-Z][A-Za-z0-9\s\(\)\[\]\.\'\-]+?)(?:\s*\([^\)]*[Rr]emix[^\)]*\))?(?:\s|$)',

            # With label prefix: [Label] Artist - Title
            r'\[([^\]]+)\]\s*([A-Z][A-Za-z0-9\s&\.\'\-]+?)\s*[-–—]\s*([A-Z][A-Za-z0-9\s\(\)\[\]\.\'\-]+)',

            # "Title" by Artist (reversed order)
            r'"([^"]+)"\s+by\s+([A-Z][A-Za-z0-9\s&\.\'\-]+)',

            # Artist: Title (colon separator)
            r'([A-Z][A-Za-z0-9\s&\.\'\-]+?):\s*([A-Z][A-Za-z0-9\s\(\)\[\]\.\'\-]+)',

            # With ID prefix: ID - Artist - Title
            r'(?:ID|id)\s*[-–—]\s*([A-Z][A-Za-z0-9\s&\.\'\-]+?)\s*[-–—]\s*([A-Z][A-Za-z0-9\s\(\)\[\]\.\'\-]+)',
        ]

        for pattern in patterns:
            matches = re.finditer(pattern, text, re.MULTILINE)
            for match in matches:
                groups = match.groups()

                # Handle different pattern formats
                if len(groups) == 3:  # [Label] Artist - Title format
                    label, artist, title = groups
                    metadata = {'label': label.strip()}
                elif pattern.startswith(r'"'):  # "Title" by Artist format (reversed)
                    title, artist = groups
                    metadata = {}
                else:  # Standard Artist - Title format
                    artist, title = groups
                    metadata = {}

                # Clean up artist and title
                artist = artist.strip()
                title = title.strip()

                # Enhanced filtering for false positives
                # Reject if:
                # - Too short (likely not a real track)
                # - Contains common non-music words
                # - Looks like a timestamp or number
                non_music_keywords = ['http', 'www', 'reddit', 'comment', 'post', 'link']

                if (len(artist) > 2 and len(title) > 2 and
                    not any(keyword in artist.lower() for keyword in non_music_keywords) and
                    not any(keyword in title.lower() for keyword in non_music_keywords) and
                    not artist.replace(' ', '').isdigit()):

                    track_dict = {
                        'artist': artist,
                        'title': title,
                        'timestamp': None
                    }
                    track_dict.update(metadata)
                    tracks.append(track_dict)

        # Remove duplicates while preserving order
        seen = set()
        unique_tracks = []
        for track in tracks:
            track_key = (track['artist'].lower(), track['title'].lower())
            if track_key not in seen:
                seen.add(track_key)
                unique_tracks.append(track)

        return unique_tracks

    def parse_tracklist_format(self, text: str) -> List[Dict]:
        """
        Parse tracklist formats:
        1. Artist - Title
        2. [00:00] Artist - Title
        3. 1. Artist - Title
        """
        tracks = []
        lines = text.split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Pattern with timestamp: [00:00] Artist - Title
            timestamp_match = re.match(r'\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(.+)', line)
            if timestamp_match:
                timestamp, rest = timestamp_match.groups()
                track_info = self.parse_artist_title_format(rest)
                if track_info:
                    track_info[0]['timestamp'] = timestamp
                    tracks.append(track_info[0])
                continue

            # Pattern with number: 1. Artist - Title
            numbered_match = re.match(r'^\d+\.\s*(.+)', line)
            if numbered_match:
                rest = numbered_match.group(1)
                track_info = self.parse_artist_title_format(rest)
                if track_info:
                    tracks.append(track_info[0])
                continue

            # Plain format: Artist - Title
            track_info = self.parse_artist_title_format(line)
            if track_info:
                tracks.append(track_info[0])

        return tracks

    def create_track_item(self, track_info: Dict, source_url: str, context: str, subreddit: str = None):
        """Create EnhancedTrackItem from parsed track information"""
        artist = track_info.get('artist', 'Unknown Artist')
        title = track_info.get('title', 'Unknown Track')
        timestamp = track_info.get('timestamp')

        # Map subreddit to genre
        genre = None
        if subreddit:
            genre = self.SUBREDDIT_GENRE_MAP.get(subreddit, None)

        # Generate deterministic track_id
        track_id = generate_track_id(
            title=title,
            primary_artist=artist,
            is_remix='remix' in title.lower(),
            is_mashup='mashup' in title.lower() or ' vs ' in title.lower(),
            remix_type=None
        )

        track_item = EnhancedTrackItem(
            track_id=track_id,
            track_name=f"{artist} - {title}",
            normalized_title=title.lower().strip(),
            is_remix='remix' in title.lower(),
            is_mashup='mashup' in title.lower() or ' vs ' in title.lower(),
            start_time=timestamp,
            source_context=context,
            track_type='Reddit Discovery',
            genre=genre,  # Add genre from subreddit mapping
            external_urls=json.dumps({'reddit': source_url}),
            metadata=json.dumps({
                'source': 'reddit',
                'subreddit': subreddit,
                'extracted_at': datetime.utcnow().isoformat(),
                'context': context
            }),
            data_source=self.name,
            scrape_timestamp=datetime.utcnow(),
            created_at=datetime.utcnow()
        )

        return track_item

    def create_playlist_from_reddit(self, post, tracks: List[Dict], subreddit_name: str = None) -> PlaylistItem:
        """Create PlaylistItem from Reddit post with tracklist"""
        try:
            # Extract artist/event from title
            title_parts = post.title.split('@')
            dj_name = title_parts[0].strip() if len(title_parts) > 0 else 'Unknown DJ'
            event_name = title_parts[1].strip() if len(title_parts) > 1 else None

            # Map subreddit to genre tags
            genre_tags = []
            if subreddit_name and subreddit_name in self.SUBREDDIT_GENRE_MAP:
                genre_tags = [self.SUBREDDIT_GENRE_MAP[subreddit_name]]

            playlist_item = PlaylistItem(
                item_type='playlist',
                name=post.title,
                source='reddit',
                source_url=f"https://reddit.com{post.permalink}",
                dj_name=dj_name,
                curator=f"u/{post.author.name}" if post.author else None,
                event_name=event_name,
                tracks=[f"{t.get('artist_name', 'Unknown')} - {t.get('track_name', 'Unknown')}" for t in tracks],
                total_tracks=len(tracks),
                description=post.selftext[:500] if post.selftext else None,
                genre_tags=genre_tags,  # Add genre tags from subreddit
                data_source=self.name,
                scrape_timestamp=datetime.utcnow(),
                created_at=datetime.utcnow()
            )

            return playlist_item

        except Exception as e:
            self.logger.error(f"Error creating playlist item: {e}")
            return None

    def is_post_processed(self, post_id: str) -> bool:
        """Check if post was already processed"""
        if post_id in self.processed_posts:
            return True

        if not self.redis_client:
            return False

        key = f"{self.redis_prefix}:{post_id}"
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            self.logger.debug(f"Redis check failed: {e}")
            return False

    def mark_post_processed(self, post_id: str):
        """Mark post as processed with TTL"""
        self.processed_posts.add(post_id)

        if not self.redis_client:
            return

        key = f"{self.redis_prefix}:{post_id}"
        ttl = 30 * 86400  # 30 days

        try:
            self.redis_client.setex(key, ttl, datetime.utcnow().isoformat())
        except Exception as e:
            self.logger.debug(f"Redis mark failed: {e}")

    def closed(self, reason):
        """Log final statistics"""
        self.logger.info(f"\n{'='*60}")
        self.logger.info(f"REDDIT MONITOR SPIDER COMPLETED")
        self.logger.info(f"{'='*60}")
        self.logger.info(f"Posts processed: {self.stats['posts_processed']}")
        self.logger.info(f"Track IDs found: {self.stats['track_ids_found']}")
        self.logger.info(f"Tracklists found: {self.stats['tracklists_found']}")
        self.logger.info(f"ID requests found: {self.stats['id_requests_found']}")
        self.logger.info(f"{'='*60}")
