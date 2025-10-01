"""
Human-Like Browser Navigator
Provides realistic browser automation using Playwright with human-like interactions
"""
import asyncio
import random
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

import structlog
from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    async_playwright,
    Playwright,
    Error as PlaywrightError
)
from pydantic import BaseModel

logger = structlog.get_logger(__name__)


class HumanLikeDelays(BaseModel):
    """Configuration for human-like timing delays"""
    min_typing_delay_ms: int = 100
    max_typing_delay_ms: int = 300
    min_mouse_movement_delay_ms: int = 50
    max_mouse_movement_delay_ms: int = 150
    min_click_delay_ms: int = 100
    max_click_delay_ms: int = 400
    min_scroll_delay_ms: int = 500
    max_scroll_delay_ms: int = 1500
    min_page_load_delay_ms: int = 1000
    max_page_load_delay_ms: int = 3000


class BrowserConfig(BaseModel):
    """Browser configuration"""
    browser_type: str = "chromium"  # 'chromium', 'firefox', 'webkit'
    headless: bool = False  # False = visible browser for human-like behavior
    viewport_width: int = 1920
    viewport_height: int = 1080
    user_agent: Optional[str] = None
    locale: str = "en-US"
    timezone: str = "America/New_York"
    use_real_chrome: bool = True  # Use actual Chrome instead of Chromium
    chrome_executable_path: Optional[str] = None  # Path to Chrome binary


class InteractionLog(BaseModel):
    """Log entry for a browser interaction"""
    interaction_type: str
    timestamp: datetime
    element_selector: Optional[str] = None
    element_text: Optional[str] = None
    interaction_data: Optional[Dict[str, Any]] = None
    duration_ms: int
    success: bool
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None


class CollectionResult(BaseModel):
    """Result of a collection operation"""
    success: bool
    source_url: str
    raw_html: Optional[str] = None
    raw_text: Optional[str] = None
    page_title: Optional[str] = None
    screenshots: List[str] = []
    interactions: List[InteractionLog] = []
    collection_duration_ms: int
    page_load_time_ms: int
    error_message: Optional[str] = None


class HumanBrowserNavigator:
    """
    Manages browser automation with realistic human-like interactions.
    Uses your actual Chrome browser for maximum compatibility.
    """

    def __init__(self, config: Optional[BrowserConfig] = None, delays: Optional[HumanLikeDelays] = None):
        self.config = config or BrowserConfig()
        self.delays = delays or HumanLikeDelays()
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.session_id: UUID = uuid4()
        self.interactions: List[InteractionLog] = []
        self.screenshots_dir = Path("/app/screenshots")
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)

    async def initialize(self):
        """Initialize Playwright and browser"""
        logger.info("Initializing browser navigator", session_id=str(self.session_id))

        self.playwright = await async_playwright().start()

        # Get browser launcher
        if self.config.browser_type == "chromium":
            browser_launcher = self.playwright.chromium
        elif self.config.browser_type == "firefox":
            browser_launcher = self.playwright.firefox
        elif self.config.browser_type == "webkit":
            browser_launcher = self.playwright.webkit
        else:
            raise ValueError(f"Unsupported browser type: {self.config.browser_type}")

        # Launch options with enhanced stealth
        launch_options: Dict[str, Any] = {
            "headless": self.config.headless,
            # Enhanced args for bot evasion
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",  # Hide automation
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor",
            ] if self.config.headless else [
                "--disable-blink-features=AutomationControlled",  # Hide automation even in headful mode
            ]
        }

        # Use actual Chrome if configured (recommended for realism)
        # Note: Chrome 141+ removed old headless mode, so use Playwright's chromium for headless
        if self.config.use_real_chrome and self.config.browser_type == "chromium" and not self.config.headless:
            # Only use real Chrome for non-headless mode
            chrome_paths = [
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "/usr/bin/chromium",
                "/usr/bin/chromium-browser",
                self.config.chrome_executable_path
            ]

            for chrome_path in chrome_paths:
                if chrome_path and Path(chrome_path).exists():
                    launch_options["executable_path"] = chrome_path
                    logger.info("Using real Chrome", path=chrome_path)
                    break
        # For headless mode, use Playwright's chromium (works better with new headless)

        self.browser = await browser_launcher.launch(**launch_options)

        # Randomized user agents for bot evasion
        user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0",
        ]
        selected_user_agent = self.config.user_agent or random.choice(user_agents)

        # Create context with realistic settings
        context_options = {
            "viewport": {
                "width": self.config.viewport_width,
                "height": self.config.viewport_height
            },
            "locale": self.config.locale,
            "timezone_id": self.config.timezone,
            "user_agent": selected_user_agent,
            "java_script_enabled": True,
            "accept_downloads": False,
            "has_touch": False,
            "is_mobile": False,
            "permissions": ["geolocation"],  # Some sites check for this
        }

        self.context = await self.browser.new_context(**context_options)

        # Inject stealth scripts to hide automation
        await self.context.add_init_script("""
            // Override navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override chrome property
            window.chrome = {
                runtime: {}
            };

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        """)

        # Add realistic headers
        await self.context.set_extra_http_headers({
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "DNT": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
        })

        logger.info("Browser initialized successfully")

    async def navigate_and_collect(
        self,
        url: str,
        navigation_steps: Optional[List[Dict[str, Any]]] = None,
        collect_screenshots: bool = True
    ) -> CollectionResult:
        """
        Navigate to URL and optionally perform interactions, then collect data

        Args:
            url: Target URL
            navigation_steps: Optional list of interaction steps to perform
            collect_screenshots: Whether to capture screenshots

        Returns:
            CollectionResult with collected data
        """
        start_time = time.time()
        page: Optional[Page] = None

        try:
            logger.info("Starting collection", url=url, session_id=str(self.session_id))

            # Create new page
            page = await self.context.new_page()

            # Track page load time
            page_load_start = time.time()

            # Navigate to URL
            # Use networkidle for JavaScript-heavy sites that continue navigating
            # This waits for network activity to stop for 500ms (no more pending requests)
            await page.goto(url, wait_until="networkidle", timeout=60000)

            # Additional delay to let any final JavaScript finish
            await self._human_delay("page_load")

            page_load_time = int((time.time() - page_load_start) * 1000)

            # Log navigation
            self._log_interaction(
                interaction_type="navigate",
                duration_ms=page_load_time,
                interaction_data={"url": url},
                success=True
            )

            # Take initial screenshot
            screenshots = []
            if collect_screenshots:
                screenshot_path = await self._take_screenshot(page, "initial")
                if screenshot_path:
                    screenshots.append(screenshot_path)

            # Perform navigation steps if provided
            if navigation_steps:
                for step in navigation_steps:
                    await self._execute_step(page, step)

                    # Take screenshot after important steps
                    if collect_screenshots and step.get("screenshot", False):
                        screenshot_path = await self._take_screenshot(
                            page,
                            f"step_{len(screenshots)}"
                        )
                        if screenshot_path:
                            screenshots.append(screenshot_path)

            # Collect page data
            raw_html = await page.content()
            page_title = await page.title()

            # Extract clean text (visible text only)
            raw_text = await page.evaluate("""() => {
                // Remove scripts, styles, and hidden elements
                const clone = document.body.cloneNode(true);
                const scripts = clone.querySelectorAll('script, style, noscript');
                scripts.forEach(el => el.remove());

                // Get text content
                return clone.innerText;
            }""")

            # Final screenshot
            if collect_screenshots:
                screenshot_path = await self._take_screenshot(page, "final")
                if screenshot_path:
                    screenshots.append(screenshot_path)

            collection_duration = int((time.time() - start_time) * 1000)

            logger.info(
                "Collection completed",
                url=url,
                duration_ms=collection_duration,
                interactions=len(self.interactions),
                screenshots=len(screenshots)
            )

            return CollectionResult(
                success=True,
                source_url=url,
                raw_html=raw_html,
                raw_text=raw_text,
                page_title=page_title,
                screenshots=screenshots,
                interactions=self.interactions.copy(),
                collection_duration_ms=collection_duration,
                page_load_time_ms=page_load_time
            )

        except Exception as e:
            collection_duration = int((time.time() - start_time) * 1000)

            logger.error(
                "Collection failed",
                url=url,
                error=str(e),
                duration_ms=collection_duration
            )

            return CollectionResult(
                success=False,
                source_url=url,
                collection_duration_ms=collection_duration,
                page_load_time_ms=0,
                error_message=str(e),
                interactions=self.interactions.copy()
            )

        finally:
            if page:
                await page.close()

    async def _execute_step(self, page: Page, step: Dict[str, Any]):
        """Execute a single navigation step with human-like behavior"""
        step_type = step.get("type")
        start_time = time.time()

        try:
            if step_type == "click":
                await self._human_click(page, step.get("selector"), step.get("text"))

            elif step_type == "type":
                await self._human_type(
                    page,
                    step.get("selector"),
                    step.get("text"),
                    step.get("clear", False)
                )

            elif step_type == "scroll":
                await self._human_scroll(
                    page,
                    step.get("direction", "down"),
                    step.get("amount", 500)
                )

            elif step_type == "wait":
                wait_ms = step.get("duration_ms", 1000)
                await asyncio.sleep(wait_ms / 1000)

            elif step_type == "wait_for_selector":
                await page.wait_for_selector(
                    step.get("selector"),
                    timeout=step.get("timeout_ms", 10000)
                )

            elif step_type == "select":
                await page.select_option(step.get("selector"), step.get("value"))
                await self._human_delay("click")

            elif step_type == "hover":
                await page.hover(step.get("selector"))
                await self._human_delay("mouse_movement")

            else:
                logger.warning("Unknown step type", step_type=step_type)

            duration_ms = int((time.time() - start_time) * 1000)
            self._log_interaction(
                interaction_type=step_type,
                element_selector=step.get("selector"),
                interaction_data=step,
                duration_ms=duration_ms,
                success=True
            )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            self._log_interaction(
                interaction_type=step_type,
                element_selector=step.get("selector"),
                interaction_data=step,
                duration_ms=duration_ms,
                success=False,
                error_message=str(e)
            )
            raise

    async def _human_click(self, page: Page, selector: str, text: Optional[str] = None):
        """Click with human-like mouse movement and timing"""
        # Wait for element
        await page.wait_for_selector(selector, state="visible", timeout=10000)

        # Get element
        if text:
            element = page.locator(selector, has_text=text)
        else:
            element = page.locator(selector).first

        # Human-like delay before click
        await self._human_delay("click")

        # Perform click
        await element.click()

        # Small delay after click
        await self._human_delay("mouse_movement")

    async def _human_type(
        self,
        page: Page,
        selector: str,
        text: str,
        clear: bool = False
    ):
        """Type text with human-like delays between keystrokes"""
        element = page.locator(selector).first

        await element.wait_for(state="visible", timeout=10000)

        # Click to focus
        await element.click()
        await self._human_delay("click")

        # Clear if requested
        if clear:
            await element.fill("")

        # Type character by character with realistic delays
        for char in text:
            await element.press_sequentially(char, delay=random.randint(
                self.delays.min_typing_delay_ms,
                self.delays.max_typing_delay_ms
            ))

        # Small delay after typing
        await self._human_delay("typing")

    async def _human_scroll(self, page: Page, direction: str = "down", amount: int = 500):
        """Scroll with human-like smoothness"""
        if direction == "down":
            await page.evaluate(f"window.scrollBy(0, {amount})")
        elif direction == "up":
            await page.evaluate(f"window.scrollBy(0, -{amount})")
        elif direction == "bottom":
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        elif direction == "top":
            await page.evaluate("window.scrollTo(0, 0)")

        await self._human_delay("scroll")

    async def _human_delay(self, action_type: str):
        """Add human-like delay based on action type"""
        if action_type == "typing":
            delay = random.randint(
                self.delays.min_typing_delay_ms,
                self.delays.max_typing_delay_ms
            )
        elif action_type == "click":
            delay = random.randint(
                self.delays.min_click_delay_ms,
                self.delays.max_click_delay_ms
            )
        elif action_type == "mouse_movement":
            delay = random.randint(
                self.delays.min_mouse_movement_delay_ms,
                self.delays.max_mouse_movement_delay_ms
            )
        elif action_type == "scroll":
            delay = random.randint(
                self.delays.min_scroll_delay_ms,
                self.delays.max_scroll_delay_ms
            )
        elif action_type == "page_load":
            delay = random.randint(
                self.delays.min_page_load_delay_ms,
                self.delays.max_page_load_delay_ms
            )
        else:
            delay = random.randint(100, 500)

        await asyncio.sleep(delay / 1000)

    async def _take_screenshot(self, page: Page, name: str) -> Optional[str]:
        """Take screenshot and return path"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{self.session_id}_{name}_{timestamp}.png"
            filepath = self.screenshots_dir / filename

            await page.screenshot(path=str(filepath), full_page=True)

            return str(filepath)

        except Exception as e:
            logger.warning("Screenshot failed", name=name, error=str(e))
            return None

    def _log_interaction(
        self,
        interaction_type: str,
        duration_ms: int,
        element_selector: Optional[str] = None,
        interaction_data: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """Log an interaction for debugging and analysis"""
        log = InteractionLog(
            interaction_type=interaction_type,
            timestamp=datetime.now(),
            element_selector=element_selector,
            interaction_data=interaction_data,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message
        )
        self.interactions.append(log)

    async def close(self):
        """Close browser and cleanup"""
        logger.info("Closing browser navigator", session_id=str(self.session_id))

        if self.context:
            await self.context.close()

        if self.browser:
            await self.browser.close()

        if self.playwright:
            await self.playwright.stop()

        logger.info("Browser navigator closed")

    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
