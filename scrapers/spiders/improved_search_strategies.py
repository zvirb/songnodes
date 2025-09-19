"""
Improved Search Strategies for All Spiders
September 2025 - Enhanced to find contemporary electronic music tracks
"""
import json
import os
from urllib.parse import quote
import re


class ImprovedSearchStrategies:
    """Enhanced search strategies for better track discovery across all spiders"""

    def __init__(self):
        self.load_target_tracks()

    def load_target_tracks(self):
        """Load the comprehensive track collection"""
        target_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'target_tracks_for_scraping.json'
        )

        with open(target_file, 'r') as f:
            self.target_data = json.load(f)

        self.all_tracks = self.target_data.get('scraper_targets', {}).get('all_tracks', [])
        self.priority_tracks = self.target_data.get('scraper_targets', {}).get('priority_tracks', [])

        # Extract unique artists with track counts
        self.artist_track_counts = {}
        for track in self.all_tracks:
            artist = track['primary_artist']
            if artist not in self.artist_track_counts:
                self.artist_track_counts[artist] = []
            self.artist_track_counts[artist].append(track['title'])

    def get_1001tracklists_searches(self):
        """Generate improved search URLs for 1001tracklists"""
        searches = []
        base_url = "https://www.1001tracklists.com/search/result/"

        # Priority: Artists with multiple tracks (they're likely to have DJ sets)
        prolific_artists = [
            artist for artist, tracks in self.artist_track_counts.items()
            if len(tracks) >= 3
        ]

        # Search by artist name first (more likely to find DJ sets)
        for artist in prolific_artists[:20]:  # Top 20 artists
            # Artist search
            searches.append({
                'url': f"{base_url}?searchstring={quote(artist)}",
                'type': 'artist',
                'target': artist
            })

            # Artist + popular track combo
            if artist in self.artist_track_counts:
                for track in self.artist_track_counts[artist][:2]:  # First 2 tracks
                    # Remove parentheses and special characters for better matching
                    clean_track = re.sub(r'\([^)]*\)', '', track).strip()
                    searches.append({
                        'url': f"{base_url}?searchstring={quote(f'{artist} {clean_track}')}",
                        'type': 'artist_track',
                        'target': f"{artist} - {clean_track}"
                    })

        # Add genre-based searches for contemporary electronic
        genres = ['tech house', 'melodic techno', 'progressive house', 'future rave']
        for genre in genres:
            searches.append({
                'url': f"{base_url}?searchstring={quote(genre)}",
                'type': 'genre',
                'target': genre
            })

        # Direct tracklist URLs for known popular sets
        searches.extend([
            {
                'url': 'https://www.1001tracklists.com/tracklist/2w9ycfr9/fisher-edc-las-vegas-united-states-2024-05-19.html',
                'type': 'direct',
                'target': 'FISHER - EDC 2024'
            },
            {
                'url': 'https://www.1001tracklists.com/tracklist/13r91hw1/anyma-tomorrowland-belgium-2024-07-27.html',
                'type': 'direct',
                'target': 'Anyma - Tomorrowland 2024'
            },
            {
                'url': 'https://www.1001tracklists.com/tracklist/nwynhqc/fred-again-coachella-festival-united-states-2024-04-12.html',
                'type': 'direct',
                'target': 'Fred again.. - Coachella 2024'
            }
        ])

        return searches

    def get_mixesdb_searches(self):
        """Generate improved search URLs for MixesDB"""
        searches = []
        base_url = "https://www.mixesdb.com/db/index.php"

        # Focus on contemporary artists
        contemporary_artists = [
            'FISHER', 'Anyma', 'Fred again..', 'Alok', 'Chris Lake',
            'Dom Dolla', 'John Summit', 'Mau P', 'I Hate Models',
            'Peggy Gou', '999999999', 'Klangkuenstler'
        ]

        for artist in contemporary_artists:
            searches.append({
                'url': f"{base_url}?title=Special%3ASearch&search={quote(artist)}",
                'type': 'artist',
                'target': artist
            })

        # Category searches for underground electronic
        categories = [
            'Category:Techno', 'Category:House', 'Category:Tech_House',
            'Category:Melodic_Techno', 'Category:Progressive_House',
            'Category:2024', 'Category:2025', 'Category:Essential_Mix'
        ]

        for category in categories:
            searches.append({
                'url': f"{base_url}/{category}",
                'type': 'category',
                'target': category.replace('Category:', '').replace('_', ' ')
            })

        return searches

    def get_setlistfm_searches(self):
        """Generate improved search parameters for Setlist.fm API"""
        searches = []

        # Focus on artists who perform live
        live_artists = [
            'Swedish House Mafia', 'Calvin Harris', 'David Guetta',
            'Martin Garrix', 'Tiësto', 'Alesso', 'FISHER', 'Chris Lake',
            'Eric Prydz', 'Deadmau5', 'Skrillex', 'Marshmello'
        ]

        for artist in live_artists:
            searches.append({
                'artist_name': artist,
                'year': '2024',
                'type': 'recent_shows'
            })
            searches.append({
                'artist_name': artist,
                'year': '2025',
                'type': 'recent_shows'
            })

        # Venue-based searches for electronic music festivals
        venues = [
            'EDC Las Vegas', 'Tomorrowland', 'Ultra Music Festival',
            'Coachella', 'Electric Forest', 'Creamfields'
        ]

        for venue in venues:
            searches.append({
                'venue_name': venue,
                'year': '2024',
                'type': 'festival'
            })

        return searches

    def get_reddit_searches(self):
        """Generate improved search queries for Reddit"""
        searches = []

        # Subreddits focused on electronic music
        subreddits = [
            'EDM', 'electronicmusic', 'House', 'Techno', 'Trance',
            'DnB', 'dubstep', 'trap', 'futurebass', 'aves'
        ]

        # Search for specific artists and tracks
        hot_tracks = [
            'FISHER Losing It', 'Anyma Consciousness', 'Fred again Marea',
            'Dom Dolla Miracle Maker', 'John Summit Where You Are'
        ]

        for subreddit in subreddits:
            # Search for track discussions
            for track in hot_tracks:
                searches.append({
                    'subreddit': subreddit,
                    'query': track,
                    'type': 'track_discussion',
                    'sort': 'relevance',
                    'time_filter': 'year'
                })

            # Search for playlist/setlist shares
            searches.append({
                'subreddit': subreddit,
                'query': 'setlist OR tracklist OR "track list"',
                'type': 'setlist',
                'sort': 'new',
                'time_filter': 'month'
            })

            # Search for "ID?" posts (track identification)
            searches.append({
                'subreddit': subreddit,
                'query': 'ID OR "track ID" OR "song name"',
                'type': 'track_id',
                'sort': 'new',
                'time_filter': 'week'
            })

        return searches

    def get_improved_selectors(self):
        """Return improved CSS selectors for each spider"""
        return {
            '1001tracklists': {
                'tracklist_links': [
                    'div.mediaItemBlock a[href*="/tracklist/"]::attr(href)',
                    'div.tlLink a[href*="/tracklist/"]::attr(href)',
                    'a.tlLink[href*="/tracklist/"]::attr(href)',
                    'div.bItm a[href*="/tracklist/"]::attr(href)',
                    'div.mediaRow a[href*="/tracklist/"]::attr(href)'
                ],
                'track_items': [
                    'div.tlpItem',
                    'div.bItm',
                    'div.mediaRow',
                    'li.tracklist-item'
                ],
                'artist_names': [
                    'span.artistName::text',
                    'a.artistLink::text',
                    'div.bTitle a::text'
                ]
            },
            'mixesdb': {
                'mix_links': [
                    'a[href*="/Category:"]::attr(href)',
                    'a[href*="/Mix:"]::attr(href)',
                    'div.searchresult a::attr(href)',
                    'ul.mw-search-results a::attr(href)'
                ],
                'tracklist_items': [
                    'ol.tracklist li',
                    'div.tracklist-item',
                    'table.tracklist tr'
                ]
            },
            'setlistfm': {
                'setlist_songs': [
                    'div.song',
                    'li.song',
                    'div.setlistSong'
                ],
                'artist_info': [
                    'span.artist-name',
                    'a.artist-link'
                ]
            }
        }


# Export for use in spiders
search_strategies = ImprovedSearchStrategies()