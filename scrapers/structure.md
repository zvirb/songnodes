Structure

musicdb_scrapy/
    scrapy.cfg (Scrapy project configuration)
    project_musicdb/
        __init__.py
        items.py (Defines the data structure for scraped items)
        middlewares.py (Not explicitly needed for this task, so I'll omit for brevity)
        pipelines.py (Processes scraped items, including normalization and storage)
        settings.py (Project-wide settings like user agents, delays, and pipelines)
        spiders/
            __init__.py
            1001tracklists_spider.py
            mixesdb_spider.py
            setlistfm_spider.py
            jambase_spider.py
            applemusic_spider.py
            reddit_spider.py
            watchthedj_spider.py
            utils.py (Helper functions for track parsing and normalization)