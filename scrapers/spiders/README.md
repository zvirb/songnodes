# SongNodes Scrapy Spiders

This directory contains all Scrapy spiders for the SongNodes project.

## Directory Structure

```
spiders/
├── __init__.py                  # Package initialization
├── base_spiders.py              # Base spider classes (no 'name' attribute)
├── utils.py                     # Utility functions
├── improved_search_strategies.py # Search strategy helpers
├── stateful_tracklist_parser.py  # Tracklist parsing utilities
│
├── *_spider.py                  # Individual spider files
│
└── stores/                      # API-based store spiders
    ├── __init__.py
    ├── beatport_spider.py
    ├── discogs_spider.py
    └── spotify_spider.py
```

## Spider Registry

**Total Spiders**: 14

### Event & Setlist Spiders
- `1001tracklists` - 1001tracklists.com DJ setlists
- `jambase` - Jambase.com event listings
- `setlistfm` - Setlist.fm concert setlists
- `watchthedj` - WatchTheDJ.com DJ schedules
- `bbc_sounds_rave_forever` - BBC Radio 6 Music Rave Forever tracklists

### Community & Social Spiders
- `reddit` - Reddit music subreddits
- `reddit_monitor` - Reddit real-time monitoring

### Store & Database Spiders
- `beatport` - Beatport electronic music store API
- `discogs` - Discogs music database API
- `spotify` - Spotify Web API
- `musicbrainz` - MusicBrainz music database
- `applemusic` - Apple Music integration

### Archive & Aggregator Spiders
- `mixesdb` - Mixesdb.com DJ mix database
- `generic_archive` - Generic archive scraper for various sources

### Testing Spiders

## Spider Naming Convention

All spiders follow these rules:

1. **Unique Names**: Each spider must have a unique `name` attribute
2. **Lowercase**: Spider names are lowercase (e.g., `beatport`, not `Beatport`)
3. **No Spaces**: Use underscores for multi-word names (e.g., `reddit_monitor`)
4. **Source-Based**: Name reflects the data source (e.g., `discogs`, `spotify`)
5. **File Convention**: Files end with `_spider.py` (e.g., `beatport_spider.py`)

## Base Classes

### BaseNextPageSpider
Generic pagination spider with automatic "next" link following.

**Example**:
```python
class MySpider(BaseNextPageSpider):
    name = 'my_spider'
    start_urls = ['https://example.com/page/1']
    next_link_selector = 'a.next-page::attr(href)'

    def parse_page_content(self, response):
        # Extract items from each page
        pass
```

### BaseJsonApiSpider
JSON API spider with pagination support (offset, page, or next_url).

**Example**:
```python
class MyApiSpider(BaseJsonApiSpider):
    name = 'my_api_spider'
    api_base_url = 'https://api.example.com/tracks'
    pagination_style = 'offset'

    def parse_api_response(self, response):
        # Parse JSON response
        pass
```

### BaseOfficialApiSpider
OAuth/API key authenticated spider for official APIs.

**Example**:
```python
class MyOAuthSpider(BaseOfficialApiSpider):
    name = 'my_oauth_spider'
    api_base_url = 'https://api.example.com/v1'
    auth_type = 'bearer'
    auth_token_env_var = 'MY_API_TOKEN'
```

## Important Notes

### ⚠️ Do NOT:
1. ❌ Add test files to this directory (use `../tests/` instead)
2. ❌ Create spiders with duplicate names
3. ❌ Add `name` attributes to base classes
4. ❌ Import spider classes in `__init__.py` (causes duplicate registration)

### ✅ Do:
1. ✅ Keep test files in `scrapers/tests/` directory
2. ✅ Use unique, descriptive spider names
3. ✅ Inherit from appropriate base classes
4. ✅ Follow file naming convention: `*_spider.py`
5. ✅ Run `python ../verify_spiders.py` before committing

## Verification

To verify there are no duplicate spider names:

```bash
# From scrapers directory
python verify_spiders.py

# Expected output:
# ✅ PASSED: Spider registry is clean
```

## Adding a New Spider

1. **Create the spider file**: `spiders/newsource_spider.py`
2. **Define the spider class**:
   ```python
   import scrapy

   class NewSourceSpider(scrapy.Spider):
       name = 'newsource'  # Must be unique!
       start_urls = ['https://newsource.com']

       def parse(self, response):
           # Implementation
           pass
   ```
3. **Verify no duplicates**: `python ../verify_spiders.py`
4. **Test the spider**: `scrapy crawl newsource`

## Running Spiders

### List all spiders:
```bash
scrapy list
```

### Run a specific spider:
```bash
scrapy crawl beatport
scrapy crawl discogs -a query="Amelie Lens"
```

### Run with output:
```bash
scrapy crawl beatport -o output.json
```

## Troubleshooting

### "UserWarning: There are several spiders with the same name"

This warning indicates duplicate spider names. To fix:

1. Run verification: `python ../verify_spiders.py`
2. Identify duplicate spider names
3. Rename or remove duplicates
4. Ensure test files are in `../tests/` directory

### Spider not discovered

1. Check file name ends with `.py`
2. Ensure class inherits from `scrapy.Spider` or base classes
3. Verify `name` attribute is defined
4. Run `scrapy list` to see discovered spiders

## References

- [Scrapy Documentation](https://docs.scrapy.org/)
- [SongNodes Development Guide](../../CLAUDE.md)
- [Spider Base Classes](./base_spiders.py)
