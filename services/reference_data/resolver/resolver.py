"""Re-export of the local MusicBrainz resolver.

The implementation lives in `common.refmb.resolve` so the worker image, which copies
`services/common` onto `/app/common`, can import it. This module remains for callers
that still import `services.reference_data.resolver`.
"""
import sys
from pathlib import Path

_services = Path(__file__).resolve().parents[2]
if str(_services) not in sys.path:
    sys.path.insert(0, str(_services))

from common.refmb.resolve import (  # noqa: E402
    ASSUMPTIONS,
    MatchResult,
    MusicBrainzResolver,
    local_candidates,
)

__all__ = ['ASSUMPTIONS', 'MatchResult', 'MusicBrainzResolver', 'local_candidates']
