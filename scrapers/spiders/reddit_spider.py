"""
Reddit Spider - Extracts music setlists from Reddit posts
"""
import scrapy
import re
from datetime import datetime
from typing import Dict, Any, Optional

class RedditSpider(scrapy.Spider):
    name = 'reddit'
    allowed_domains = ['reddit.com', 'old.reddit.com']
    
    # Example URLs - can be overridden by scraper orchestrator
    start_urls = [
        'https://old.reddit.com/r/EDM/comments/example1',
        'https://old.reddit.com/r/ElectronicMusic/comments/example2'
    ]
    
    custom_settings = {
        'USER_AGENT': 'MusicDB Scraper 1.0',
        'DOWNLOAD_DELAY': 2,
        'CONCURRENT_REQUESTS': 2,
        'ROBOTSTXT_OBEY': True,
        'RETRY_TIMES': 2,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 408, 429]
    }
    
    def parse(self, response):
        """Parse Reddit post for setlist information"""
        
        # Extract basic post information
        setlist_item = {
            'source': 'reddit',
            'url': response.url,
            'scraped_at': datetime.now().isoformat(),
        }
        
        # Extract post title
        title = response.css('h1::text').get() or response.css('title::text').get()
        if title:
            setlist_item['title'] = title.strip()
        
        # Extract post body using simpler selectors
        post_body = response.css('div.usertext-body div.md::text').getall()
        if not post_body:
            # Try alternative selector for new Reddit
            post_body = response.css('div[data-test-id="post-content"] p::text').getall()
        
        if post_body:
            setlist_item['content'] = '\n'.join(post_body)
            
            # Extract potential track names using regex patterns
            tracks = self.extract_tracks(setlist_item.get('content', ''))
            if tracks:
                setlist_item['tracks'] = tracks
        
        # Extract comments for additional track information
        comments = response.css('div.comment div.md::text').getall()
        if comments:
            setlist_item['comments'] = comments[:10]  # Limit to first 10 comments
        
        yield setlist_item
    
    def extract_tracks(self, text: str) -> list:
        """Extract potential track names from text"""
        tracks = []
        
        # Common patterns for track listings
        patterns = [
            r'^\d+\.\s+(.+?)(?:\s+[-–]\s+(.+?))?$',  # Numbered list
            r'^[-•]\s+(.+?)(?:\s+[-–]\s+(.+?))?$',   # Bullet points
            r'^\[(\d+:\d+)\]\s+(.+?)(?:\s+[-–]\s+(.+?))?$',  # Timestamps
        ]
        
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            for pattern in patterns:
                match = re.match(pattern, line, re.MULTILINE)
                if match:
                    track_info = {
                        'raw_text': line
                    }
                    groups = match.groups()
                    if len(groups) >= 1 and groups[0]:
                        track_info['title'] = groups[0].strip()
                    if len(groups) >= 2 and groups[1]:
                        track_info['artist'] = groups[1].strip()
                    tracks.append(track_info)
                    break
        
        return tracks