"""Utility helpers that generate curated search strategies for enhanced spiders."""
from __future__ import annotations

from typing import Dict, List

# These lists intentionally stay modest so they can be run within a single
# batch without tripping rate limits. The enhanced spiders rotate over them,
# so feel free to augment the lists as your catalogue grows.


def get_1001tracklists_searches() -> List[Dict[str, str]]:
    """Return seed search URLs and metadata for 1001Tracklists."""
    base = "https://www.1001tracklists.com/search/result/?searchstring="
    seeds = [
        ("progressive+house", "genre"),
        ("melodic+techno", "genre"),
        ("tech+house", "genre"),
        ("fred+again", "artist"),
        ("anyma", "artist"),
        ("fishersets", "keyword"),
        ("live+2025", "keyword"),
    ]

    results: List[Dict[str, str]] = []
    for query, query_type in seeds:
        results.append(
            {
                "url": f"{base}{query}",
                "type": query_type,
                "target": query.replace("+", " "),
            }
        )
    return results


def get_mixesdb_searches() -> List[Dict[str, str]]:
    """Return curated MixesDB search URLs for recent/underground content."""
    seeds = [
        "https://www.mixesdb.com/db/index.php/Special:RecentChanges",
        "https://www.mixesdb.com/db/index.php/Category:Mixes",
        "https://www.mixesdb.com/db/index.php/Category:Tech_House",
        "https://www.mixesdb.com/db/index.php/Category:Melodic_Techno",
        "https://www.mixesdb.com/db/index.php/Category:Hybrid_House",
    ]

    return [{"url": url, "type": "category", "target": url.split(":")[-1]} for url in seeds]


def get_reddit_searches() -> List[Dict[str, str]]:
    """
    Reddit search strategies for Tier 3 community-driven track identification.

    Returns subreddit monitoring targets optimized for early track discovery.
    Note: reddit_monitor_spider uses PRAW API, not direct HTTP scraping.
    """
    # High-value subreddits for track identification (organized by purpose)
    subreddits = {
        # Direct track ID requests - highest value for "latency advantage"
        'id_requests': ['IdentifyThisTrack', 'NameThatSong', 'tipofmytongue'],

        # Genre-specific communities - active tracklist sharing
        'genre_techno': ['Techno', 'tech_house', 'MelodicTechno'],
        'genre_trance': ['Trance', 'trance', 'PsyTrance'],
        'genre_hardstyle': ['hardstyle', 'Hardstyle'],
        'genre_house': ['House', 'deephouse', 'techhouse'],
        'genre_dnb': ['DnB', 'jungle', 'neurofunk'],

        # Festival and event communities
        'festivals': ['electricdaisycarnival', 'Tomorrowland', 'Ultra', 'festivals'],

        # General electronic music
        'general': ['EDM', 'electronicmusic', 'tracklists', 'DJs']
    }

    # Flatten into search items
    search_items = []
    for category, subreddit_list in subreddits.items():
        for subreddit in subreddit_list:
            search_items.append({
                "url": f"https://www.reddit.com/r/{subreddit}/new/.json",
                "type": "subreddit",
                "target": subreddit,
                "category": category,
                "priority": "high" if category == 'id_requests' else "medium"
            })

    return search_items


def get_direct_tracklist_urls() -> List[Dict[str, str]]:
    """Return curated list of direct tracklist URLs that bypass rate limiting."""
    # These are known working tracklist URLs that don't require search
    # UPDATED: September 2025 - use current URLs from homepage
    direct_urls = [
        "https://www.1001tracklists.com/tracklist/xfux16t/dj-elax-mix-time-hash754-media-fm-105.5-2025-09-30.html",
        "https://www.1001tracklists.com/tracklist/19k8pgt1/walter-pizzulli-m2o-morning-show-2025-09-29.html",
        "https://www.1001tracklists.com/tracklist/27by7wuk/hillmer-brave-factory-festival-ukraine-2025-08-23.html",
        "https://www.1001tracklists.com/tracklist/l86txc9/chester-young-young-nation-show-264-2025-09-30.html",
        "https://www.1001tracklists.com/tracklist/xfuwtdt/robert-burian-stagezone-41-2025-09-30.html",
        # Add more as discovered - these URLs can be collected from social media, forums, etc.
    ]

    return [{"url": url, "type": "direct", "target": url.split("/")[-1].replace(".html", "")} for url in direct_urls]


def get_improved_selectors() -> Dict:
    """Return improved CSS selectors for different platforms."""
    return {
        "1001tracklists": {
            "tracklist_links": [
                # Search results page selectors
                "div.tlLink a::attr(href)",
                "div.bTitle a::attr(href)",
                "a.tlLink::attr(href)",
                # Table based results
                "table.table-borderless.table-striped.table-sm a[href*='/tracklist/']::attr(href)",
                "table.table a[href*='/tracklist/']::attr(href)",
                # Generic search results
                "div.row a[href*='/tracklist/']::attr(href)",
                ".list-group a[href*='/tracklist/']::attr(href)",
                "div.search-results a[href*='/tracklist/']::attr(href)",
                # Fallback to any tracklist links
                "a[href*='/tracklist/']::attr(href)"
            ],
            "track_info": [
                ".tracklist-track",
                ".tl-track-row",
                "div[data-tid]",
                ".track-row",
                "tr.track",
                "div.tlpTog"
            ]
        },
        "mixesdb": {
            "tracklist_links": [
                "a[href*='Category:']",
                ".mw-category-group a",
                "#mw-content-text a"
            ]
        }
    }
