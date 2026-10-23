"""Independent-method consensus for BPM and key evidence (WP3/WP4, non-audio part).

Rules from the plan: store every source's measurement; never count one upstream source twice as
independent agreement; fold half/double tempo only with genre justification; distinguish exact
agreement from near-agreement; select by agreement, then configured source trust; preserve
disagreements and set `review` so a `v_metadata_conflicts` view can list them.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

from . import camelot, tempo

DEFAULT_TRUST: Tuple[str, ...] = ('manual', 'beatport', 'tidal', 'deezer', 'getsongbpm', 'acousticbrainz', 'musicbrainz')


@dataclass(frozen=True)
class Evidence:
    field: str                              # 'bpm' | 'key'
    value: Any                              # BPM number, or any key notation `to_camelot` understands
    source: str
    method: str = 'provider'
    method_version: Optional[str] = None
    independent_group: Optional[str] = None  # shared by sources that republish the same upstream measurement
    confidence: Optional[float] = None
    measured_at: Optional[datetime] = None

    @property
    def group(self) -> str:
        return self.independent_group or self.source


@dataclass(frozen=True)
class Consensus:
    value: Optional[Any]
    status: str                              # consensus | single_source | unresolved | unknown
    chosen: Optional[Evidence] = None
    supporting_groups: Tuple[str, ...] = ()
    near_groups: Tuple[str, ...] = ()        # agree only after an octave / relative-key / neighbour step
    conflicting: Tuple[Evidence, ...] = ()   # evidence that neither agrees nor nearly agrees
    folded: bool = False
    fold_status: Optional[str] = None
    review: bool = False


def trust_rank(source: str, trust: Sequence[str]) -> int:
    return trust.index(source) if source in trust else len(trust)


def _consensus(items: List[Tuple[Evidence, Any]], exact: Callable[[Any, Any], bool],
               near: Callable[[Any, Any], bool], trust: Sequence[str]) -> Tuple[Optional[Evidence], Any, List[List[int]], List[Evidence]]:
    """Cluster by exact agreement; return (chosen evidence, its normalised value, clusters of indexes, ranked)."""
    clusters: List[List[int]] = []
    for index, (_, value) in enumerate(items):
        for cluster in clusters:
            if exact(items[cluster[0]][1], value):
                cluster.append(index)
                break
        else:
            clusters.append([index])

    def best_member(cluster):
        return min(cluster, key=lambda i: (trust_rank(items[i][0].source, trust), -(items[i][0].confidence or 0.0), i))

    def key(cluster):
        groups = {items[i][0].group for i in cluster}
        return (-len(groups), trust_rank(items[best_member(cluster)][0].source, trust), clusters.index(cluster))

    ranked = sorted(clusters, key=key)
    winner = ranked[0]
    chosen_index = best_member(winner)
    return items[chosen_index][0], items[chosen_index][1], ranked, winner


def _build(items, exact, near, trust, folded_flags=None) -> Consensus:
    if not items:
        return Consensus(None, 'unknown')
    chosen, value, ranked, winner = _consensus(items, exact, near, trust)
    support = tuple(sorted({items[i][0].group for i in winner}))
    others = [i for cluster in ranked[1:] for i in cluster]
    near_groups, conflicting = set(), []
    for i in others:
        evidence, other = items[i]
        if evidence.group in support:
            continue  # the same upstream already counted for the winner; not an independent dissent
        if near(value, other):
            near_groups.add(evidence.group)
        else:
            conflicting.append(evidence)
    groups_total = {e.group for e, _ in items}
    if len(groups_total) == 1:
        status = 'single_source'
    elif len(support) >= 2:
        status = 'consensus'
    else:
        status = 'unresolved'
    review = bool(near_groups or conflicting) or status == 'unresolved'
    return Consensus(value=value, status=status, chosen=chosen, supporting_groups=support,
                     near_groups=tuple(sorted(near_groups)), conflicting=tuple(conflicting), review=review)


def bpm_consensus(evidence: Iterable[Evidence], genres: Optional[Sequence[str]] = None,
                  trust: Sequence[str] = DEFAULT_TRUST, tolerance: float = 0.005) -> Consensus:
    """BPM consensus. Unknown/zero BPM is dropped; tempi are folded only when `genres` justify it."""
    items: List[Tuple[Evidence, float]] = []
    folded_by_index: Dict[int, str] = {}
    for item in evidence:
        if item.field != 'bpm':
            continue
        folded, status = tempo.fold_tempo(item.value, genres)
        if folded is None:
            continue
        folded_by_index[len(items)] = status
        items.append((item, folded))
    result = _build(
        items,
        exact=lambda a, b: tempo.tempo_agreement(a, b, tolerance) == 'exact',
        near=lambda a, b: tempo.tempo_agreement(a, b, tolerance) == 'octave',
        trust=trust)
    if result.chosen is None:
        return result
    index = next(i for i, (e, _) in enumerate(items) if e is result.chosen)
    original = tempo.known_bpm(result.chosen.value)
    return Consensus(**{**result.__dict__, 'folded': original != result.value, 'fold_status': folded_by_index[index]})


def key_agreement(a: str, b: str) -> Optional[str]:
    """'exact', 'near' (relative major/minor or +-1 on the wheel), or None for two Camelot codes."""
    if a == b:
        return 'exact'
    na, la, nb, lb = int(a[:-1]), a[-1], int(b[:-1]), b[-1]
    if na == nb and la != lb:
        return 'near'
    if la == lb and (na - nb) % 12 in (1, 11):
        return 'near'
    return None


def key_consensus(evidence: Iterable[Evidence], trust: Sequence[str] = DEFAULT_TRUST) -> Consensus:
    """Key consensus on Camelot codes; unparseable keys are dropped, not guessed."""
    items = [(item, code) for item in evidence if item.field == 'key'
             for code in [camelot.to_camelot(item.value)] if code]
    return _build(items, exact=lambda a, b: a == b, near=lambda a, b: key_agreement(a, b) == 'near', trust=trust)
