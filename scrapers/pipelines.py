import csv
import os
import json
import re
from collections import defaultdict

class MusicDataPipeline:
    def __init__(self):
        self.headers = {
            'ArtistItem': ['artist_name'],
            'AlbumItem': ['album_name', 'artist_name'],
            'TrackItem': ['track_name', 'album_name', 'isrc', 'tidal_id', 'track_type', 'is_remix', 'is_mashup', 'mashup_components'],
            'SetlistItem': ['setlist_name', 'dj_artist_name', 'event_name', 'venue_name', 'set_date', 'last_updated_date'],
            'TrackArtistItem': ['track_name', 'artist_name', 'artist_role'],
            'PlaylistTrackItem': ['playlist_name', 'track_name', 'track_order'],
            'SetlistTrackItem': ['setlist_name', 'track_name', 'track_order', 'start_time'],
        }
        self.data_storage = defaultdict(list) # To hold data before writing to CSV

    def open_spider(self, spider):
        # Create a directory for output CSVs if it doesn't exist
        os.makedirs('output', exist_ok=True)

    def close_spider(self, spider):
        for item_type, data_list in self.data_storage.items():
            file_path = f'output/{item_type.replace("Item", "").lower()}s.csv'
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.headers[item_type])
                writer.writeheader()
                writer.writerows(data_list)
            spider.logger.info(f"Saved {len(data_list)} {item_type}s to {file_path}")

    def process_item(self, item, spider):
        item_type = type(item).__name__
        processed_item = self.normalize_item(item, item_type)
        self.data_storage[item_type].append(processed_item)
        return item

    def normalize_item(self, item, item_type):
        # Convert Scrapy Item to a dictionary for easier processing
        data = dict(item)

        # Apply general normalization rules
        for key, value in data.items():
            if isinstance(value, str):
                data[key] = self.normalize_text(value)
            elif isinstance(value, list):
                data[key] = [self.normalize_text(v) if isinstance(v, str) else v for v in value]

        # Specific normalization based on item type
        if 'artist_name' in data:
            data['artist_name'] = self.normalize_artist_name(data['artist_name'])
        if 'track_name' in data:
            data['track_name'] = self.normalize_track_name(data['track_name'])

        # Handle mashup_components for TrackItem: store as JSON string or None for CSV
        if item_type == 'TrackItem':
            if 'mashup_components' in data and data['mashup_components']: # If list is not empty
                data['mashup_components'] = json.dumps(data['mashup_components'])
            else: # If list is empty or key doesn't exist (will be handled by loop below if key missing)
                data['mashup_components'] = None

        # Ensure all expected fields are present, fill missing with None
        for header in self.headers[item_type]:
            if header not in data:
                data[header] = None

        return data

    def normalize_text(self, text):
        if text is None:
            return None
        text = text.strip()
        text = re.sub(r'\s+', ' ', text) # Replace multiple spaces with single space
        return text

    def normalize_artist_name(self, name):
        if name is None:
            return None
        name = self.normalize_text(name)
        # Example: Standardize "Fred again.." to "Fred Again.."
        name = re.sub(r'fred again\.\.', 'Fred Again..', name, flags=re.IGNORECASE) # [3]
        # Add more artist-specific normalization rules here
        return name

    def normalize_track_name(self, name):
        if name is None:
            return None
        name = self.normalize_text(name)
        # Example: Remove common parenthetical notes if not relevant to uniqueness
        # This is a simplified example; more complex logic is in parse_track_string
        name = re.sub(r'\s*\((Original Mix|Radio Edit|Extended Mix)\)\s*', '', name, flags=re.IGNORECASE)
        return name