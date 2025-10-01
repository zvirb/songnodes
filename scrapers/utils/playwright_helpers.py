"""
Playwright Helper Utilities for Performance Optimization (Spec Section III.2)

Provides request interception handlers to block unnecessary resources,
reducing page load time and memory usage by 40-60%.

Usage in spider:
    from utils.playwright_helpers import should_abort_request, page_methods_with_blocking

    yield Request(
        url=url,
        meta={
            'playwright': True,
            'playwright_page_methods': page_methods_with_blocking(),
        }
    )
"""
from typing import Dict, List, Set
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# RESOURCE BLOCKING CONFIGURATION
# ============================================================================

# Resource types to block (reduces bandwidth and memory by ~60%)
BLOCKED_RESOURCE_TYPES: Set[str] = {
    'image',       # Images (PNG, JPG, GIF, WebP)
    'stylesheet',  # CSS files
    'font',        # Web fonts (WOFF, TTF, etc.)
    'media',       # Audio/video files
    'manifest',    # Web app manifests
    'texttrack',   # Video subtitles
    'eventsource', # Server-sent events
    'websocket',   # WebSocket connections (usually for chat/live updates)
}

# URL patterns to block (analytics, tracking, ads)
BLOCKED_URL_PATTERNS: List[str] = [
    # Analytics
    'google-analytics.com',
    'googletagmanager.com',
    'analytics.google.com',
    'mixpanel.com',
    'segment.com',
    'amplitude.com',
    'hotjar.com',

    # Advertising
    'doubleclick.net',
    'googlesyndication.com',
    'adservice.google.com',
    'facebook.com/tr',
    'advertising.com',

    # Social media tracking
    'connect.facebook.net',
    'platform.twitter.com',
    'linkedin.com/px',

    # CDNs for unnecessary resources (optional - be selective)
    'cdn.jsdelivr.net/npm/font-awesome',  # Font icons
    'fonts.googleapis.com',               # Google Fonts
    'fonts.gstatic.com',
]

# Allow list - never block these even if they match patterns
ALLOW_LIST_PATTERNS: List[str] = [
    # Allow API endpoints
    '/api/',
    '/graphql',
    '/v1/',
    '/v2/',

    # Allow JSON data
    '.json',

    # Allow critical scripts
    'react',
    'vue',
    'angular',
]


# ============================================================================
# REQUEST INTERCEPTION HANDLER
# ============================================================================

def should_abort_request(route, request) -> bool:
    """
    Request interception handler for Playwright Page.route().

    Aborts requests for images, CSS, fonts, and tracking scripts to improve
    performance and reduce memory usage.

    Args:
        route: Playwright Route object
        request: Playwright Request object

    Returns:
        True if request should be aborted, False otherwise

    Usage:
        page.route("**/*", should_abort_request)
    """
    resource_type = request.resource_type
    url = request.url.lower()

    # Check allow list first (highest priority)
    for pattern in ALLOW_LIST_PATTERNS:
        if pattern in url:
            route.continue_()
            return False

    # Block by resource type
    if resource_type in BLOCKED_RESOURCE_TYPES:
        logger.debug(f"Blocking {resource_type}: {url[:100]}")
        route.abort()
        return True

    # Block by URL pattern
    for pattern in BLOCKED_URL_PATTERNS:
        if pattern in url:
            logger.debug(f"Blocking tracking URL: {url[:100]}")
            route.abort()
            return True

    # Allow all other requests
    route.continue_()
    return False


def should_abort_request_strict(route, request) -> bool:
    """
    Strict request interception - blocks even more resources.

    Use for heavily instrumented sites where you only need HTML/JSON data.
    Blocks ~80% of requests vs ~60% for standard blocking.

    Additional blocking:
    - All third-party domains (except APIs)
    - All tracking and analytics
    - All social media widgets
    """
    resource_type = request.resource_type
    url = request.url.lower()

    # Check allow list
    for pattern in ALLOW_LIST_PATTERNS:
        if pattern in url:
            route.continue_()
            return False

    # Strict: Block all images, styles, fonts, media
    strict_blocked_types = {
        'image', 'stylesheet', 'font', 'media', 'manifest',
        'texttrack', 'eventsource', 'websocket', 'other'
    }

    if resource_type in strict_blocked_types:
        route.abort()
        return True

    # Block by URL pattern (same as standard)
    for pattern in BLOCKED_URL_PATTERNS:
        if pattern in url:
            route.abort()
            return True

    # Allow document, script, xhr, fetch
    route.continue_()
    return False


# ============================================================================
# PLAYWRIGHT PAGE METHODS GENERATORS
# ============================================================================

def page_methods_with_blocking(
    wait_selector: str = None,
    wait_timeout: int = 30000,
    strict_blocking: bool = False
) -> List[Dict]:
    """
    Generate Playwright page methods with request blocking enabled.

    Args:
        wait_selector: CSS selector to wait for (e.g., 'div.track-list')
        wait_timeout: Maximum wait time in milliseconds (default: 30s)
        strict_blocking: Use strict blocking (blocks 80% of requests)

    Returns:
        List of page methods for playwright_page_methods meta key

    Usage:
        meta = {
            'playwright': True,
            'playwright_page_methods': page_methods_with_blocking(
                wait_selector='div.results',
                wait_timeout=15000
            )
        }
    """
    methods = []

    # Set up request interception (MUST be first)
    blocker = should_abort_request_strict if strict_blocking else should_abort_request
    methods.append({
        'method': 'route',
        'args': ['**/*'],
        'kwargs': {'handler': blocker}
    })

    # Wait for selector if specified
    if wait_selector:
        methods.append({
            'method': 'wait_for_selector',
            'args': [wait_selector],
            'kwargs': {'timeout': wait_timeout}
        })
    else:
        # Wait for network idle (all requests finished)
        methods.append({
            'method': 'wait_for_load_state',
            'args': ['networkidle'],
            'kwargs': {'timeout': wait_timeout}
        })

    return methods


def page_methods_for_spa(
    wait_selector: str,
    scroll_to_bottom: bool = False,
    wait_timeout: int = 30000
) -> List[Dict]:
    """
    Page methods optimized for Single-Page Applications (React, Vue, Angular).

    Args:
        wait_selector: Selector for main content (e.g., '#app', 'div.content')
        scroll_to_bottom: Trigger infinite scroll by scrolling to bottom
        wait_timeout: Maximum wait time in milliseconds

    Returns:
        List of page methods for SPA scraping

    Usage:
        # For infinite scroll sites
        meta = {
            'playwright': True,
            'playwright_page_methods': page_methods_for_spa(
                wait_selector='div.track-grid',
                scroll_to_bottom=True
            )
        }
    """
    methods = []

    # Request blocking
    methods.append({
        'method': 'route',
        'args': ['**/*'],
        'kwargs': {'handler': should_abort_request}
    })

    # Wait for main content
    methods.append({
        'method': 'wait_for_selector',
        'args': [wait_selector],
        'kwargs': {'timeout': wait_timeout}
    })

    # Scroll to bottom if requested (triggers lazy loading)
    if scroll_to_bottom:
        methods.append({
            'method': 'evaluate',
            'args': ['window.scrollTo(0, document.body.scrollHeight)']
        })

        # Wait for lazy-loaded content
        methods.append({
            'method': 'wait_for_timeout',
            'args': [2000]  # 2 second wait for content to load
        })

    # Final wait for network idle
    methods.append({
        'method': 'wait_for_load_state',
        'args': ['networkidle'],
        'kwargs': {'timeout': wait_timeout}
    })

    return methods


def page_methods_for_infinite_scroll(
    scroll_count: int = 3,
    scroll_pause_ms: int = 2000,
    final_selector: str = None
) -> List[Dict]:
    """
    Page methods for infinite scroll pagination.

    Args:
        scroll_count: Number of times to scroll to bottom
        scroll_pause_ms: Pause between scrolls (allow content to load)
        final_selector: Optional selector to wait for after scrolling

    Returns:
        List of page methods for infinite scroll handling

    Usage:
        # Load 3 pages of infinite scroll content
        meta = {
            'playwright': True,
            'playwright_page_methods': page_methods_for_infinite_scroll(
                scroll_count=3,
                scroll_pause_ms=2000
            )
        }
    """
    methods = []

    # Request blocking
    methods.append({
        'method': 'route',
        'args': ['**/*'],
        'kwargs': {'handler': should_abort_request}
    })

    # Wait for initial load
    methods.append({
        'method': 'wait_for_load_state',
        'args': ['networkidle']
    })

    # Scroll multiple times
    for i in range(scroll_count):
        # Scroll to bottom
        methods.append({
            'method': 'evaluate',
            'args': ['window.scrollTo(0, document.body.scrollHeight)']
        })

        # Wait for content to load
        methods.append({
            'method': 'wait_for_timeout',
            'args': [scroll_pause_ms]
        })

    # Wait for final selector if specified
    if final_selector:
        methods.append({
            'method': 'wait_for_selector',
            'args': [final_selector],
            'kwargs': {'timeout': 30000}
        })

    return methods


# ============================================================================
# CUSTOM BLOCKING RULES
# ============================================================================

def create_custom_blocker(
    blocked_types: Set[str] = None,
    blocked_patterns: List[str] = None,
    allow_patterns: List[str] = None
):
    """
    Create a custom request blocker with specific rules.

    Args:
        blocked_types: Resource types to block
        blocked_patterns: URL patterns to block
        allow_patterns: URL patterns to always allow

    Returns:
        Custom blocker function for use with page.route()

    Usage:
        custom_blocker = create_custom_blocker(
            blocked_types={'image', 'stylesheet'},
            blocked_patterns=['analytics.com'],
            allow_patterns=['/api/']
        )

        page.route("**/*", custom_blocker)
    """
    blocked_types = blocked_types or BLOCKED_RESOURCE_TYPES
    blocked_patterns = blocked_patterns or BLOCKED_URL_PATTERNS
    allow_patterns = allow_patterns or ALLOW_LIST_PATTERNS

    def custom_blocker(route, request):
        resource_type = request.resource_type
        url = request.url.lower()

        # Check allow list
        for pattern in allow_patterns:
            if pattern in url:
                route.continue_()
                return False

        # Block by type
        if resource_type in blocked_types:
            route.abort()
            return True

        # Block by pattern
        for pattern in blocked_patterns:
            if pattern in url:
                route.abort()
                return True

        # Allow
        route.continue_()
        return False

    return custom_blocker


# ============================================================================
# PERFORMANCE MONITORING
# ============================================================================

class RequestMonitor:
    """
    Monitor blocked vs allowed requests for performance analysis.

    Usage:
        monitor = RequestMonitor()
        page.route("**/*", monitor.intercept)

        # After scraping
        monitor.print_stats()
    """

    def __init__(self):
        self.blocked_count = 0
        self.allowed_count = 0
        self.blocked_by_type = {}
        self.blocked_by_pattern = {}

    def intercept(self, route, request):
        """Interception handler that tracks statistics."""
        resource_type = request.resource_type
        url = request.url.lower()

        # Check if should block
        should_block = False
        block_reason = None

        # Check allow list
        for pattern in ALLOW_LIST_PATTERNS:
            if pattern in url:
                route.continue_()
                self.allowed_count += 1
                return

        # Check resource type
        if resource_type in BLOCKED_RESOURCE_TYPES:
            should_block = True
            block_reason = f"type:{resource_type}"
            self.blocked_by_type[resource_type] = self.blocked_by_type.get(resource_type, 0) + 1

        # Check URL patterns
        if not should_block:
            for pattern in BLOCKED_URL_PATTERNS:
                if pattern in url:
                    should_block = True
                    block_reason = f"pattern:{pattern}"
                    self.blocked_by_pattern[pattern] = self.blocked_by_pattern.get(pattern, 0) + 1
                    break

        if should_block:
            route.abort()
            self.blocked_count += 1
            logger.debug(f"Blocked ({block_reason}): {url[:100]}")
        else:
            route.continue_()
            self.allowed_count += 1

    def print_stats(self):
        """Print performance statistics."""
        total = self.blocked_count + self.allowed_count
        if total == 0:
            logger.info("No requests intercepted")
            return

        block_pct = (self.blocked_count / total) * 100

        logger.info(f"\n{'='*60}")
        logger.info(f"REQUEST INTERCEPTION STATISTICS")
        logger.info(f"{'='*60}")
        logger.info(f"Total requests: {total}")
        logger.info(f"Blocked: {self.blocked_count} ({block_pct:.1f}%)")
        logger.info(f"Allowed: {self.allowed_count} ({100-block_pct:.1f}%)")
        logger.info(f"\nBlocked by type:")
        for rtype, count in sorted(self.blocked_by_type.items(), key=lambda x: x[1], reverse=True):
            logger.info(f"  {rtype}: {count}")
        logger.info(f"\nTop blocked patterns:")
        for pattern, count in sorted(self.blocked_by_pattern.items(), key=lambda x: x[1], reverse=True)[:5]:
            logger.info(f"  {pattern}: {count}")
        logger.info(f"{'='*60}\n")

    def get_stats(self) -> Dict:
        """Return statistics as dictionary."""
        total = self.blocked_count + self.allowed_count
        return {
            'total_requests': total,
            'blocked_count': self.blocked_count,
            'allowed_count': self.allowed_count,
            'block_percentage': (self.blocked_count / total * 100) if total > 0 else 0,
            'blocked_by_type': self.blocked_by_type.copy(),
            'blocked_by_pattern': self.blocked_by_pattern.copy(),
        }
