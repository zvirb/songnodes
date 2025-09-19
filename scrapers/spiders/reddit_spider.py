"""
Enhanced Reddit Spider for Contemporary Music Discovery
Focuses on electronic music subreddits and track discussions
"""
import scrapy
import re
import praw
from datetime import datetime
from urllib.parse import quote

try:
    from ..items import (
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem
    )
except ImportError:
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import (
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem
    )


class RedditSpider(scrapy.Spider):
    name = 'reddit'
    allowed_domains = ['reddit.com', 'old.reddit.com', 'www.reddit.com']

    custom_settings = {
        'USER_AGENT': 'MusicDB Enhanced Scraper 2.0 (Electronic Music Discovery)',
        'DOWNLOAD_DELAY': 3,
        'CONCURRENT_REQUESTS': 1,
        'ROBOTSTXT_OBEY': True,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 408, 429]
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Load search strategies
        from .improved_search_strategies import search_strategies
        self.search_items = search_strategies.get_reddit_searches()

        # Generate start URLs
        self.start_urls = self.generate_reddit_urls()

    def generate_reddit_urls(self):
        """Generate Reddit search URLs for contemporary tracks"""
        urls = []
        base_url = "https://old.reddit.com"

        # Electronic music subreddits
        subreddits = [
            'EDM', 'electronicmusic', 'House', 'Techno', 'tech_house',
            'MelodicTechno', 'Trance', 'DnB', 'dubstep', 'trap',
            'futurebass', 'aves', 'festivals', 'electricdaisycarnival'
        ]

        # Contemporary artists and tracks to search for
        hot_searches = [
            # Artists
            'FISHER', 'Anyma', 'Fred again', 'Chris Lake', 'John Summit',
            'Dom Dolla', 'Mau P', 'Swedish House Mafia 2024', 'Alok',
            # Popular tracks
            'Losing It', 'Consciousness', 'Marea', 'Turn On The Lights',
            'Where You Are', 'Miracle Maker', 'girl$',
            # General searches
            'tracklist 2024', 'setlist 2024', 'EDC 2024', 'Tomorrowland 2024',
            'Ultra 2024', 'best tracks 2024', 'ID track'
        ]

        # Generate search URLs for each subreddit
        for subreddit in subreddits[:10]:  # Limit to top 10 subreddits
            # Search for hot tracks/artists
            for search_term in hot_searches[:5]:  # Top 5 searches per subreddit
                search_query = quote(search_term)
                urls.append(f"{base_url}/r/{subreddit}/search?q={search_query}&restrict_sr=on&sort=relevance&t=year")

            # Get hot posts from subreddit
            urls.append(f"{base_url}/r/{subreddit}/top/?t=month")
            urls.append(f"{base_url}/r/{subreddit}/hot/")

        # Direct searches across all of Reddit
        for search_term in ['FISHER setlist', 'Anyma tracklist', 'Fred again playlist']:
            search_query = quote(search_term)
            urls.append(f"{base_url}/search?q={search_query}&sort=new&t=month")

        return urls[:50]  # Limit to 50 URLs

    def parse(self, response):
        """Parse Reddit search results or subreddit pages"""

        # Handle search results page
        if '/search' in response.url or '/hot' in response.url or '/top' in response.url:
            # Extract post links
            post_links = response.css('a.title::attr(href)').getall()
            if not post_links:
                # Try alternative selectors
                post_links = response.css('h3 a::attr(href)').getall()

            for link in post_links[:10]:  # Process top 10 posts
                if not link.startswith('http'):
                    link = 'https://old.reddit.com' + link

                # Filter for relevant posts
                if any(keyword in link.lower() for keyword in ['tracklist', 'setlist', 'playlist', 'mix', 'set', 'live']):
                    yield scrapy.Request(
                        url=link,
                        callback=self.parse_post,
                        meta={'source_url': response.url}
                    )

        # Parse individual post
        else:
            yield from self.parse_post(response)

    def parse_post(self, response):
        """Parse individual Reddit post for music information"""

        # Extract post title
        title = response.css('h1::text').get() or response.css('title::text').get() or ''

        # Extract post body
        post_body = ' '.join(response.css('div.usertext-body div.md *::text').getall())
        if not post_body:
            post_body = ' '.join(response.css('div[data-test-id="post-content"] *::text').getall())

        # Look for track patterns in post
        tracks_found = self.extract_track_info(title + '\n' + post_body)

        # Extract setlist information if tracks found
        if tracks_found:
            # Create setlist item
            setlist_name = self.extract_setlist_name(title)
            if setlist_name:
                yield EnhancedSetlistItem(
                    setlist_name=setlist_name,
                    dj_artist_name=self.extract_artist_from_title(title),
                    event_name=self.extract_event_from_title(title),
                    venue_name=None,
                    set_date=self.extract_date_from_post(response),
                    last_updated_date=datetime.utcnow(),
                    data_source='reddit',
                    source_url=response.url
                )

                # Yield track items
                for idx, track_info in enumerate(tracks_found):
                    yield EnhancedTrackItem(
                        track_name=track_info['name'],
                        original_artist=track_info.get('artist'),
                        remixer_artist=track_info.get('remixer'),
                        genre=track_info.get('genre'),
                        is_remix=bool(track_info.get('remixer')),
                        is_mashup='vs' in track_info['name'].lower() or 'mashup' in track_info['name'].lower(),
                        data_source='reddit'
                    )

                    # Yield artist relationships
                    if track_info.get('artist'):
                        yield EnhancedTrackArtistItem(
                            track_name=track_info['name'],
                            artist_name=track_info['artist'],
                            artist_role='original',
                            data_source='reddit'
                        )

    def extract_track_info(self, text):
        """Extract track information from Reddit post text"""
        tracks = []

        # Patterns for track extraction
        patterns = [
            # Numbered tracks: "1. Artist - Track Name"
            r'^\d+\.\s+([^-–]+?)\s*[-–]\s*(.+?)(?:\s*\[(.+?)\])?$',
            # Timestamp tracks: "[0:00] Artist - Track Name"
            r'^\[(\d+:\d+)\]\s*([^-–]+?)\s*[-–]\s*(.+?)$',
            # Bullet tracks: "• Artist - Track Name (Remix)"
            r'^[•·-]\s*([^-–]+?)\s*[-–]\s*(.+?)(?:\s*\((.+?)\))?$',
            # Track ID format: "ID - Artist - Track"
            r'^(?:ID\s*[-–]\s*)?([^-–]+?)\s*[-–]\s*(.+?)$'
        ]

        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue

            for pattern in patterns:
                match = re.match(pattern, line, re.MULTILINE)
                if match:
                    groups = match.groups()
                    track = {}

                    if pattern.startswith(r'^\['):  # Timestamp pattern
                        track['timestamp'] = groups[0]
                        track['artist'] = groups[1].strip() if len(groups) > 1 else None
                        track['name'] = groups[2].strip() if len(groups) > 2 else groups[1].strip()
                    else:
                        track['artist'] = groups[0].strip() if groups[0] else None
                        track['name'] = groups[1].strip() if len(groups) > 1 else groups[0].strip()

                        # Check for remix in parentheses
                        if len(groups) > 2 and groups[2]:
                            if 'remix' in groups[2].lower():
                                track['remixer'] = groups[2].replace('Remix', '').strip()

                    # Clean up track name
                    track['name'] = re.sub(r'\s+', ' ', track['name'])

                    if track.get('name') and len(track['name']) > 3:
                        tracks.append(track)
                    break

        return tracks

    def extract_setlist_name(self, title):
        """Extract setlist name from post title"""
        # Common patterns in Reddit titles
        patterns = [
            r'(.+?)\s+(?:@|at)\s+(.+?)(?:\s+\d{4})?',  # "Artist @ Venue 2024"
            r'(.+?)\s+(?:tracklist|setlist|playlist)',  # "Artist tracklist"
            r'(?:tracklist|setlist|playlist)\s*:\s*(.+)',  # "Setlist: Artist"
        ]

        for pattern in patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                return match.group(0)

        return title if 'track' in title.lower() or 'set' in title.lower() else None

    def extract_artist_from_title(self, title):
        """Extract artist name from post title"""
        # Common patterns
        patterns = [
            r'^([^@\-–]+?)(?:\s*[@\-–])',  # "Artist @ Venue"
            r'^\[([^\]]+)\]',  # "[Artist] setlist"
            r'^(\w+(?:\s+\w+)?)\s+(?:live|set|mix)',  # "Artist live"
        ]

        for pattern in patterns:
            match = re.search(pattern, title, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return None

    def extract_event_from_title(self, title):
        """Extract event name from post title"""
        # Look for festival/event names
        events = [
            'EDC', 'Ultra', 'Tomorrowland', 'Coachella', 'Electric Forest',
            'Creamfields', 'Electric Zoo', 'Beyond Wonderland', 'Lost Lands'
        ]

        for event in events:
            if event.lower() in title.lower():
                # Try to extract full event name with year
                pattern = rf'{event}[^,\s]*\s*\d{{4}}'
                match = re.search(pattern, title, re.IGNORECASE)
                if match:
                    return match.group(0)
                return event

        return None

    def extract_date_from_post(self, response):
        """Extract date from Reddit post metadata"""
        # Try to get post timestamp
        time_element = response.css('time::attr(datetime)').get()
        if time_element:
            try:
                return datetime.fromisoformat(time_element.replace('Z', '+00:00'))
            except:
                pass

        return None
