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
    """Placeholder for Reddit strategies (kept for completeness)."""
    return [
        {"url": "https://www.reddit.com/r/electronicmusic/new/.json", "type": "subreddit", "target": "electronicmusic"},
        {"url": "https://www.reddit.com/r/Techno/new/.json", "type": "subreddit", "target": "Techno"},
    ]


def get_improved_selectors() -> Dict:
    """Return improved CSS selectors for different platforms."""
    return {
        "1001tracklists": {
            "tracklist_links": [
                "table.table-borderless.table-striped.table-sm a[href*='/tracklist/']",
                "div.row a[href*='/tracklist/']",
                ".list-group a[href*='/tracklist/']",
                "a[href*='/tracklist/']"
            ],
            "track_info": [
                ".track-row",
                ".tracklist-track",
                "tr.track"
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
