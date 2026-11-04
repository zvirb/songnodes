"""The live mirror is not available in CI. Cascade behaviour is covered by
services/common/tests/test_ref_mb_resolve.py with a mocked connection.
"""
from services.reference_data.resolver.resolver import MusicBrainzResolver
from common.refmb.resolve import ISRC_SQL


def test_resolver_reexport_and_isrc_cast():
    assert MusicBrainzResolver is not None
    assert '$1::bpchar' in ISRC_SQL
