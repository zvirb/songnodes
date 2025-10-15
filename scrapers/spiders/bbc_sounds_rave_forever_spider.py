"""BBC Sounds Rave Forever spider.

Scrapes tracklists for BBC Radio 6 Music's "Rave Forever" programme. The flow is:

1. (Optional) Authenticate against BBC Sounds using the configured credentials.
2. Traverse the paginated episode guide for the series.
3. Visit each episode page and extract the structured tracklist metadata.
4. Emit enhanced setlist / track items so downstream pipelines ingest enriched data.

The spider relies on scrapy-playwright to perform the login flow, since the BBC
sign-in form is rendered client-side. Credentials are read from the environment
variables `BBC_SOUNDS_USERNAME` and `BBC_SOUNDS_PASSWORD`.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional
from urllib.parse import urljoin

import scrapy
from scrapy import Request

try:  # Scrapy project import path
    from ..items import (
        EnhancedSetlistItem,
        EnhancedSetlistTrackItem,
        EnhancedTrackArtistItem,
        EnhancedTrackItem,
    )
    from ..pydantic_models import DataSource
    from ..track_id_generator import generate_track_id
    from ..secrets_utils import resolve_secret
except ImportError:  # Standalone execution fallback
    from items import (  # type: ignore
        EnhancedSetlistItem,
        EnhancedSetlistTrackItem,
        EnhancedTrackArtistItem,
        EnhancedTrackItem,
    )
    from pydantic_models import DataSource  # type: ignore
    from track_id_generator import generate_track_id  # type: ignore
    from secrets_utils import resolve_secret  # type: ignore


class BBCSoundsRaveForeverSpider(scrapy.Spider):
    name = "bbc_sounds_rave_forever"
    allowed_domains = ["bbc.co.uk", "www.bbc.co.uk", "account.bbc.com"]

    # Base endpoints
    LOGIN_URL = "https://account.bbc.com/signin"
    EPISODE_GUIDE_URL = "https://www.bbc.co.uk/programmes/m001dkv1/episodes/guide"

    # Shared Playwright context keeps authenticated cookies between requests
    PLAYWRIGHT_CONTEXT = "bbc-sounds-session"

    custom_settings = {
        "CONCURRENT_REQUESTS": 2,
        "DOWNLOAD_DELAY": 2,
        "AUTOTHROTTLE_ENABLED": True,
        "AUTOTHROTTLE_START_DELAY": 2,
        "AUTOTHROTTLE_MAX_DELAY": 10,
    }

    def __init__(
        self,
        max_pages: Optional[int] = None,
        episode_url: Optional[str] = None,
        episode_urls: Optional[str] = None,
        *args,
        **kwargs,
    ) -> None:
        super().__init__(*args, **kwargs)

        self.username = resolve_secret("BBC_SOUNDS_USERNAME")
        self.password = resolve_secret("BBC_SOUNDS_PASSWORD")
        self.max_pages = int(max_pages) if max_pages else None
        self.login_attempted = False
        self.target_episode_urls: Optional[List[str]] = None

        # Allow CLI args to target specific episode URLs (comma-separated)
        urls_from_args: List[str] = []
        if episode_urls:
            urls_from_args.extend([u.strip() for u in episode_urls.split(",") if u.strip()])
        if episode_url:
            urls_from_args.append(episode_url.strip())

        if urls_from_args:
            # Deduplicate while preserving order
            seen = set()
            cleaned: List[str] = []
            for url in urls_from_args:
                if url and url not in seen:
                    cleaned.append(url)
                    seen.add(url)
            self.target_episode_urls = cleaned or None

    # ------------------------------------------------------------------
    # Scrapy entrypoints
    # ------------------------------------------------------------------
    def start_requests(self) -> Iterable[Request]:
        """Kick off by authenticating (if credentials supplied)."""

        if self.username and self.password:
            self.logger.info("Attempting BBC Sounds login before scraping episodes")
            self.login_attempted = True
            yield Request(
                url=self.LOGIN_URL,
                callback=self.after_login,
                errback=self.handle_request_error,
                dont_filter=True,
                meta={
                    "playwright": True,
                    "playwright_context": self.PLAYWRIGHT_CONTEXT,
                    "download_timeout": 90,
                    "playwright_page_coroutines": [self._perform_login],
                },
            )
        else:
            if not self.username or not self.password:
                self.logger.warning(
                    "BBC Sounds credentials missing; continuing without authentication"
                )
            yield from self._entry_requests()

    def after_login(self, response: scrapy.http.Response) -> Iterable[Request]:
        """Proceed to the episode guide after the login attempt."""

        if response.status >= 400:
            self.logger.warning(
                "Login request returned HTTP %s; continuing regardless", response.status
            )

        yield from self._entry_requests()

    def _entry_requests(self) -> Iterable[Request]:
        """Yield entry requests based on targeted or full series scraping."""
        if self.target_episode_urls:
            for url in self.target_episode_urls:
                episode_pid = self._extract_pid_from_url(url)
                yield self._episode_detail_request(
                    episode_url=url,
                    episode_pid=episode_pid,
                    episode_title=None,
                )
        else:
            yield from self._episode_requests(page_number=1)

    # ------------------------------------------------------------------
    # Request factories
    # ------------------------------------------------------------------
    def _episode_requests(self, page_number: int) -> Iterable[Request]:
        url = self.EPISODE_GUIDE_URL
        if page_number > 1:
            url = f"{url}?page={page_number}"

        yield Request(
            url=url,
            callback=self.parse_episode_list,
            errback=self.handle_request_error,
            meta={
                "playwright": True,
                "playwright_context": self.PLAYWRIGHT_CONTEXT,
                "download_timeout": 90,
                "page_number": page_number,
            },
        )

    def _episode_detail_request(
        self,
        episode_url: str,
        episode_pid: Optional[str],
        episode_title: Optional[str],
    ) -> Request:
        return Request(
            url=episode_url,
            callback=self.parse_episode_page,
            errback=self.handle_request_error,
            meta={
                "playwright": True,
                "playwright_context": self.PLAYWRIGHT_CONTEXT,
                "download_timeout": 90,
                "episode_pid": episode_pid,
                "episode_title": episode_title,
            },
        )

    # ------------------------------------------------------------------
    # Parsing logic
    # ------------------------------------------------------------------
    def parse_episode_list(self, response: scrapy.http.HtmlResponse) -> Iterable[Request]:
        page_number = response.meta.get("page_number", 1)
        self.logger.info("Parsing Rave Forever episode guide page %s", page_number)

        episodes = response.css("div.programme[data-pid]")
        if not episodes:
            self.logger.warning("No episode entries were found on %s", response.url)

        for episode in episodes:
            episode_pid = episode.attrib.get("data-pid")
            episode_title = episode.css(".programme__title span::text").get()
            episode_href = episode.css("a.br-blocklink__link::attr(href)").get()

            if not episode_href:
                continue

            episode_url = urljoin(response.url, episode_href)
            yield self._episode_detail_request(episode_url, episode_pid, episode_title)

        next_href = response.css("li.pagination__next a::attr(href)").get()
        if next_href:
            next_page_number = page_number + 1
            if self.max_pages and next_page_number > self.max_pages:
                self.logger.info(
                    "Reached max_pages=%s – stopping pagination", self.max_pages
                )
            else:
                next_url = urljoin(response.url, next_href)
                yield Request(
                    url=next_url,
                    callback=self.parse_episode_list,
                    errback=self.handle_request_error,
                    meta={
                        "playwright": True,
                        "playwright_context": self.PLAYWRIGHT_CONTEXT,
                        "download_timeout": 90,
                        "page_number": next_page_number,
                    },
                )

    def parse_episode_page(self, response: scrapy.http.HtmlResponse) -> Iterable[scrapy.Item]:
        episode_pid = response.meta.get("episode_pid")
        episode_title = response.meta.get("episode_title")

        metadata = self._extract_episode_metadata(response)

        title = metadata.get("name") if metadata else episode_title
        series_name = (
            metadata.get("partOfSeries", {}).get("name") if metadata else None
        )
        description = metadata.get("description") if metadata else None
        date_str = metadata.get("datePublished") if metadata else None
        set_date = None
        if date_str:
            try:
                set_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                self.logger.debug("Unable to parse episode date '%s'", date_str)

        tracks = list(self._parse_tracklist(response))
        total_tracks = len(tracks)

        if not title:
            title = response.css("h1.programme__title::text").get() or "Rave Forever"
        if not series_name:
            series_name = "6 Music's Rave Forever"

        if not episode_pid:
            episode_pid = metadata.get("identifier") if metadata else self._extract_pid_from_url(response.url)

        setlist_item = EnhancedSetlistItem(
            setlist_name=title,
            description=description,
            dj_artist_name=series_name,
            event_name=title,
            event_type="Radio Show",
            set_date=set_date,
            total_tracks=total_tracks,
            metadata={
                "episode_pid": episode_pid,
                "episode_number": metadata.get("episodeNumber") if metadata else None,
            },
            external_urls={"bbc_sounds": response.url},
            data_source=DataSource.BBC_SOUNDS.value,
            scrape_timestamp=datetime.now(timezone.utc),
        )

        yield setlist_item

        for index, track in enumerate(tracks, start=1):
            track_name = track["title"]
            artist_name = track["artist"]
            record_label = track.get("label")
            release_info = track.get("release")

            track_id = generate_track_id(
                title=track_name,
                primary_artist=artist_name or "Various Artists",
            )

            track_item = EnhancedTrackItem(
                track_id=track_id,
                track_name=track_name,
                artist_name=artist_name,
                record_label=record_label,
                track_type="Radio Show",
                source_context=title,
                position_in_source=index,
                metadata={"episode_pid": episode_pid, "release": release_info},
                data_source=DataSource.BBC_SOUNDS.value,
                scrape_timestamp=datetime.now(timezone.utc),
            )
            yield track_item

            yield EnhancedTrackArtistItem(
                track_name=track_name,
                track_id=track_id,
                artist_name=artist_name,
                artist_role="primary",
                position=0,
                data_source=DataSource.BBC_SOUNDS.value,
                scrape_timestamp=datetime.now(timezone.utc),
            )

            yield EnhancedSetlistTrackItem(
                setlist_name=setlist_item["setlist_name"],
                track_name=track_name,
                track_id=track_id,
                track_order=index,
                data_source=DataSource.BBC_SOUNDS.value,
                scrape_timestamp=datetime.now(timezone.utc),
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    async def _perform_login(self, page) -> None:
        """Playwright coroutine that fills the BBC login form."""

        try:
            await page.wait_for_load_state("domcontentloaded", timeout=15000)

            # Dismiss cookie banners if present (best-effort)
            await self._click_first_selector(
                page,
                [
                    "button[aria-label='Agree to all']",
                    "button:has-text('Accept')",
                    "button:has-text('OK')",
                ],
                timeout=3000,
            )

            email_input = await self._wait_for_first_selector(
                page,
                [
                    "input#user-identifier-input",
                    "input[name='username']",
                    "input[type='email']",
                ],
            )
            if not email_input:
                self.logger.error("BBC login page did not expose an email input")
                return
            await email_input.fill(self.username)

            password_input = await self._wait_for_first_selector(
                page,
                [
                    "input#password-input",
                    "input[name='password']",
                    "input[type='password']",
                ],
            )
            if not password_input:
                self.logger.error("BBC login page did not expose a password input")
                return
            await password_input.fill(self.password)

            # Submit the form
            submitted = await self._click_first_selector(
                page,
                [
                    "button#submit-button",
                    "button[type='submit']",
                    "button:has-text('Sign in')",
                ],
                timeout=5000,
            )
            if not submitted:
                await password_input.press("Enter")

            try:
                await page.wait_for_url(
                    lambda url: "signin" not in url.lower(), timeout=20000
                )
            except Exception:
                self.logger.debug("Login redirect did not complete before timeout")

        except Exception as exc:  # pragma: no cover - defensive path
            self.logger.error("BBC login sequence failed: %s", exc)

    async def _wait_for_first_selector(
        self,
        page,
        selectors: List[str],
        timeout: int = 5000,
    ):
        for selector in selectors:
            try:
                element = await page.wait_for_selector(selector, timeout=timeout)
                if element:
                    return element
            except Exception:
                continue
        return None

    async def _click_first_selector(
        self,
        page,
        selectors: List[str],
        timeout: int = 3000,
    ) -> bool:
        for selector in selectors:
            try:
                element = await page.wait_for_selector(selector, timeout=timeout)
                if element:
                    await element.click()
                    return True
            except Exception:
                continue
        return False

    def _extract_episode_metadata(self, response: scrapy.http.HtmlResponse) -> Dict:
        for script in response.xpath("//script[@type='application/ld+json']/text()").getall():
            try:
                data = json.loads(script)
            except json.JSONDecodeError:
                continue

            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("@type") == "RadioEpisode":
                        return item
            elif isinstance(data, dict) and data.get("@type") == "RadioEpisode":
                return data

        return {}

    def _parse_tracklist(self, response: scrapy.http.HtmlResponse) -> Iterable[Dict]:
        for segment in response.css("li.segments-list__item--music"):
            artist = self._clean_text(segment.css("span.artist::text").get())
            title_texts = segment.css("div.segment__track p span::text").getall()
            title = self._clean_text(" ".join(title_texts))

            if not title:
                continue

            label_text = segment.css("ul li abbr[title='Record Label']::text").get()
            label = self._clean_text(label_text, strip_trailing_period=True)
            release_text = segment.css("ul li em::text").get()

            yield {
                "artist": artist or "Various Artists",
                "title": title,
                "label": label,
                "release": self._clean_text(release_text),
            }

    @staticmethod
    def _clean_text(value: Optional[str], strip_trailing_period: bool = False) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if strip_trailing_period and cleaned.endswith("."):
            cleaned = cleaned[:-1].rstrip()
        return cleaned or None

    @staticmethod
    def _extract_pid_from_url(url: str) -> Optional[str]:
        match = re.search(r"/programmes/([a-z0-9]+)", url)
        return match.group(1) if match else None

    def handle_request_error(self, failure):  # pragma: no cover - network errors
        page = failure.request.meta.get("playwright_page")
        if page:
            try:
                asyncio.get_event_loop().create_task(page.close())
            except Exception:
                pass
        self.logger.error("BBC Sounds request failed: %s", failure)
