"""
Test data fixtures and factories for SongNodes testing.
"""

import factory
from datetime import datetime, timedelta
import random
from faker import Faker
from typing import Dict, List, Any

fake = Faker()


class TrackDataFactory(factory.Factory):
    """Factory for generating test track data."""
    
    class Meta:
        model = dict
    
    track_name = factory.LazyAttribute(lambda obj: fake.catch_phrase())
    primary_artists = factory.LazyAttribute(
        lambda obj: [fake.name() for _ in range(random.randint(1, 3))]
    )
    featured_artists = factory.LazyAttribute(
        lambda obj: [fake.name() for _ in range(random.randint(0, 2))]
    )
    remixer_artists = factory.LazyAttribute(
        lambda obj: [fake.name() for _ in range(random.randint(0, 1))]
    )
    is_remix = factory.LazyAttribute(lambda obj: random.choice([True, False]))
    is_mashup = factory.LazyAttribute(lambda obj: random.choice([True, False]))
    mashup_components = factory.LazyAttribute(
        lambda obj: [fake.catch_phrase() for _ in range(random.randint(0, 3))]
    )
    start_time = factory.LazyAttribute(
        lambda obj: f"{random.randint(0, 3)}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}"
    )
    track_type = factory.LazyAttribute(
        lambda obj: random.choice(["Original", "Remix", "Mashup", "Edit"])
    )


class SetlistDataFactory(factory.Factory):
    """Factory for generating test setlist data."""
    
    class Meta:
        model = dict
    
    setlist_name = factory.LazyAttribute(lambda obj: f"{fake.name()} Live Set")
    dj_artist_name = factory.LazyAttribute(lambda obj: fake.name())
    event_name = factory.LazyAttribute(lambda obj: f"{fake.word().title()} Festival")
    venue_name = factory.LazyAttribute(lambda obj: f"{fake.word().title()} Club")
    set_date = factory.LazyAttribute(
        lambda obj: (datetime.now() - timedelta(days=random.randint(1, 365))).strftime("%Y-%m-%d")
    )
    last_updated_date = factory.LazyAttribute(
        lambda obj: datetime.now().strftime("%Y-%m-%d") if random.choice([True, False]) else None
    )


class ScrapingTaskDataFactory(factory.Factory):
    """Factory for generating test scraping task data."""
    
    class Meta:
        model = dict
    
    scraper = factory.LazyAttribute(
        lambda obj: random.choice(["1001tracklists", "mixesdb", "setlistfm", "reddit"])
    )
    url = factory.LazyAttribute(lambda obj: fake.url())
    priority = factory.LazyAttribute(
        lambda obj: random.choice(["low", "medium", "high", "critical"])
    )
    params = factory.LazyAttribute(
        lambda obj: {
            "test_mode": True,
            "expected_tracks": random.randint(10, 100),
            "timeout": random.randint(30, 300)
        }
    )
    retry_count = 0
    max_retries = 3


class APIResponseFactory(factory.Factory):
    """Factory for generating test API responses."""
    
    class Meta:
        model = dict
    
    status = "success"
    data = factory.LazyAttribute(lambda obj: {})
    message = factory.LazyAttribute(lambda obj: fake.sentence())
    timestamp = factory.LazyAttribute(lambda obj: datetime.now().isoformat())


# Sample data collections
SAMPLE_TRACKS = [
    {
        "track_name": "Levels",
        "primary_artists": ["Avicii"],
        "featured_artists": [],
        "remixer_artists": [],
        "is_remix": False,
        "is_mashup": False,
        "mashup_components": [],
        "start_time": "00:00:00",
        "track_type": "Original"
    },
    {
        "track_name": "Titanium",
        "primary_artists": ["David Guetta"],
        "featured_artists": ["Sia"],
        "remixer_artists": [],
        "is_remix": False,
        "is_mashup": False,
        "mashup_components": [],
        "start_time": "03:30:00",
        "track_type": "Original"
    },
    {
        "track_name": "One More Time",
        "primary_artists": ["Daft Punk"],
        "featured_artists": [],
        "remixer_artists": ["Deadmau5"],
        "is_remix": True,
        "is_mashup": False,
        "mashup_components": [],
        "start_time": "07:15:00",
        "track_type": "Remix"
    }
]

SAMPLE_SETLISTS = [
    {
        "setlist_name": "Ultra Music Festival 2023 Main Stage",
        "dj_artist_name": "Martin Garrix",
        "event_name": "Ultra Music Festival",
        "venue_name": "Bayfront Park",
        "set_date": "2023-03-25",
        "last_updated_date": "2023-03-26"
    },
    {
        "setlist_name": "Tomorrowland Belgium 2023",
        "dj_artist_name": "Armin van Buuren",
        "event_name": "Tomorrowland",
        "venue_name": "De Schorre",
        "set_date": "2023-07-22",
        "last_updated_date": "2023-07-23"
    }
]

SAMPLE_SCRAPING_TASKS = [
    {
        "scraper": "1001tracklists",
        "url": "https://www.1001tracklists.com/tracklist/test-example.html",
        "priority": "high",
        "params": {"test_mode": True, "expected_tracks": 25}
    },
    {
        "scraper": "mixesdb",
        "url": "https://mixesdb.com/test/example-mix",
        "priority": "medium",
        "params": {"test_mode": True, "expected_tracks": 15}
    }
]

# HTML fixtures for spider testing
SAMPLE_HTML_1001TRACKLISTS = """
<!DOCTYPE html>
<html>
<head><title>Test Tracklist</title></head>
<body>
    <h1 class="spotlightTitle">Martin Garrix - Ultra Music Festival 2023</h1>
    <div class="spotlight-artists">
        <a href="/artist/martin-garrix">Martin Garrix</a>
    </div>
    <div class="spotlight-event">
        <a href="/event/ultra-music-festival">Ultra Music Festival</a>
    </div>
    <div class="spotlight-venue">
        <a href="/venue/bayfront-park">Bayfront Park</a>
    </div>
    <div class="spotlight-date">2023-03-25</div>
    
    <div class="tlpItem">
        <span class="trackValue">Avicii - Levels</span>
        <span class="tracklist-time">00:00</span>
    </div>
    <div class="tlpItem">
        <span class="trackValue">David Guetta feat. Sia - Titanium</span>
        <span class="tracklist-time">03:30</span>
    </div>
    <div class="tlpItem">
        <span class="trackValue">Deadmau5 vs Daft Punk - One More Time (Mashup)</span>
        <span class="tracklist-time">07:15</span>
    </div>
</body>
</html>
"""

SAMPLE_HTML_MIXESDB = """
<!DOCTYPE html>
<html>
<head><title>Mix Details</title></head>
<body>
    <div class="mix-header">
        <h1>Progressive House Mix</h1>
        <div class="dj-name">Above & Beyond</div>
        <div class="mix-date">2023-06-15</div>
    </div>
    
    <div class="tracklist">
        <div class="track-item">
            <span class="track-info">1. Cosmic Gate - Exploration of Space</span>
            <span class="track-time">0:00</span>
        </div>
        <div class="track-item">
            <span class="track-info">2. Above & Beyond - Sun & Moon (Extended Mix)</span>
            <span class="track-time">4:30</span>
        </div>
    </div>
</body>
</html>
"""

# Mock API responses
MOCK_API_RESPONSES = {
    "health_check": {
        "status": "healthy",
        "timestamp": "2023-12-01T12:00:00Z",
        "version": "1.0.0"
    },
    "scrapers_status": {
        "1001tracklists": {
            "status": "idle",
            "config": {
                "name": "1001tracklists",
                "enabled": True,
                "concurrent_requests": 8,
                "download_delay": 1.0
            },
            "health": {
                "healthy": True,
                "last_check": "2023-12-01T12:00:00Z"
            }
        }
    },
    "task_submission": {
        "task_id": "test_task_123456",
        "status": "queued",
        "message": "Task submitted successfully"
    },
    "queue_status": {
        "queue": {
            "critical": 0,
            "high": 2,
            "medium": 5,
            "low": 1
        },
        "total": 8
    }
}

# Performance test data
PERFORMANCE_TEST_CONFIG = {
    "target_host": "http://localhost:8080",
    "users": 50,
    "spawn_rate": 5,
    "run_time": "120s",
    "thresholds": {
        "avg_response_time": 100,  # ms
        "p95_response_time": 200,  # ms
        "error_rate": 0.01,  # 1%
        "requests_per_second": 100,
        "throughput_tracks_per_hour": 20000
    }
}

# Database test data
DATABASE_TEST_DATA = {
    "tracks": [
        {
            "id": 1,
            "name": "Test Track 1",
            "duration": 180,
            "bpm": 128,
            "key": "C major",
            "genre": "House",
            "created_at": "2023-12-01T12:00:00Z"
        },
        {
            "id": 2,
            "name": "Test Track 2", 
            "duration": 240,
            "bpm": 132,
            "key": "G minor",
            "genre": "Techno",
            "created_at": "2023-12-01T13:00:00Z"
        }
    ],
    "artists": [
        {
            "id": 1,
            "name": "Test Artist 1",
            "genre": "Electronic",
            "country": "Netherlands",
            "created_at": "2023-12-01T12:00:00Z"
        }
    ],
    "setlists": [
        {
            "id": 1,
            "name": "Test Setlist 1",
            "dj_artist_id": 1,
            "event_name": "Test Event",
            "venue_name": "Test Venue",
            "set_date": "2023-12-01",
            "created_at": "2023-12-01T12:00:00Z"
        }
    ]
}


def generate_test_tracks(count: int = 10) -> List[Dict[str, Any]]:
    """Generate a list of test tracks."""
    return [TrackDataFactory() for _ in range(count)]


def generate_test_setlists(count: int = 5) -> List[Dict[str, Any]]:
    """Generate a list of test setlists."""
    return [SetlistDataFactory() for _ in range(count)]


def generate_test_tasks(count: int = 10) -> List[Dict[str, Any]]:
    """Generate a list of test scraping tasks."""
    return [ScrapingTaskDataFactory() for _ in range(count)]


def get_sample_html(source: str) -> str:
    """Get sample HTML for testing scrapers."""
    html_samples = {
        "1001tracklists": SAMPLE_HTML_1001TRACKLISTS,
        "mixesdb": SAMPLE_HTML_MIXESDB
    }
    return html_samples.get(source, "<html><body></body></html>")


def get_mock_api_response(endpoint: str) -> Dict[str, Any]:
    """Get mock API response for testing."""
    return MOCK_API_RESPONSES.get(endpoint, {"error": "Unknown endpoint"})


# Test environment configuration
TEST_CONFIG = {
    "database": {
        "host": "localhost",
        "port": 5433,
        "name": "test_musicdb",
        "user": "test_user",
        "password": "test_password"
    },
    "redis": {
        "host": "localhost",
        "port": 6380
    },
    "api": {
        "base_url": "http://localhost:8080",
        "timeout": 30
    },
    "performance": {
        "max_response_time": 100,  # ms
        "target_throughput": 20000,  # tracks/hour
        "max_error_rate": 0.01  # 1%
    }
}