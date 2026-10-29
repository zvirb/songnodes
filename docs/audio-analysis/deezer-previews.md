# Key and BPM from Deezer previews

*Written 28 Oct 2026 for AA2. Terms read on 28 Oct 2026.*

## Conclusion

**Deezer's developer terms do not mention analysing previews, either to allow it or to forbid it.** They do restrict
the API to non-commercial, strictly private use, they forbid storing audio, and they say any purpose other than
building "Webpages and/or Personal Applications" needs Deezer's prior approval. SongNodes is a personal application
run privately by its owner, the job keeps no audio, and the owner chose Deezer previews on 28 Oct 2026, so
**`AUDIO_ANALYSIS_ENABLED` defaults to `true`.**

One clause can be read against this use (see "Risk" below). If SongNodes is ever shared, hosted for others, or used
commercially, switch the job off and ask Deezer first.

## What the terms say

Sources:

- Terms of use for Deezer for Developers: <https://developers.deezer.com/termsofuse> (no date on the page; it says
  the version posted there binds immediately)
- Developer guidelines: <https://developers.deezer.com/guidelines>

| Clause | What it says | Effect here |
|---|---|---|
| Terms I and II(a) | Free API access "in order to develop Webpages and/or Personal Applications" that give access to Deezer's content, including audio. | SongNodes is a personal application. |
| Terms IV, Non-commercial use | "strictly limited for a non-commercial purpose and in a non-commercial environment"; the developer "shall not perceive, receive, generate, benefit or create directly or indirectly, any moneys, incomes, revenues, data or any other consideration in connection with" the services or the content. "The use of the Content is limited to a strictly private use within a family scope." | Private, non-commercial use only. See "Risk" for the word "data". |
| Terms IV | Without Premium+, recordings are "accessible only up to 30 seconds". | We use the 30-second preview only. |
| Terms V, DRM | Do not bypass DRM "for the purpose of downloading the Content". | Preview MP3s are public URLs returned by `/track/{id}`; nothing is bypassed. |
| Terms IX | Use "for any other purposes than those mentioned herein, shall be beforehand reviewed and approved by DEEZER". | Analysis is not named as a purpose. This is the main open point. |
| Guidelines, Local/Offline storage | "Local Storage/Offline Storage of audio data is strictly forbidden." | The clip is in a temporary file only while it is analysed and is deleted at the end of the request. Nothing is cached or kept. |
| Guidelines, streaming URL privacy | Only 30-second extract URLs may be visible to end users; do not make audio downloadable. | Preview URLs are fetched fresh by the worker and never shown or stored. |

Nothing in either page mentions audio analysis, feature extraction, machine listening or data mining.

## Risk

Section IV's list of things the developer must not "generate … in connection with … Content" includes "data". In
context the sentence defines non-commercial use (money, income, revenue, "or any other consideration"), but a strict
reading could count a measured key or BPM as data generated from the content. Section IX also leaves any purpose not
listed open to Deezer's approval. We read the terms as allowing private, non-commercial analysis for the owner's own
library, but this is a judgement, not a grant. Deezer can withdraw API access at any time (Terms II(c)).

## What the job does

- Every `AUDIO_ANALYSIS_INTERVAL_SECONDS` (600) the worker runs the `audio_analysis` job
  (`services/common/datalayer/audio.py`). It picks up to `AUDIO_ANALYSIS_PER_RUN` (10) tracks that have a
  `deezer_id` but no BPM or no key, library tracks first, skipping any track tried in the last 30 days.
- For each it asks Deezer `/track/{id}` for a fresh preview URL and sends that URL to the `audio-analysis` service
  (`POST /analyze-url`). The service downloads the clip (5 MB and 20 s at most, audio content types only, Deezer
  hosts only), runs the Essentia analyser and deletes the file.
- The result is stored as evidence (`source = 'audio_analysis'`, `method = 'audio'`), only for the fields the track is
  missing. Consensus then sets `bpm`, `key` and `camelot_key`; manual and Beatport values are never replaced.
- Deezer quota errors (code 4) stop the run; it is retried later.

## Switching it off

Set `AUDIO_ANALYSIS_ENABLED=false` in your shell or the untracked `.env` next to `compose.dev.yaml`, then recreate
the worker:

```bash
docker compose -f compose.dev.yaml up -d --no-build --force-recreate worker
```

The job still appears in the schedule but does nothing: no Deezer calls, no downloads. Evidence already recorded
stays; to remove it, delete the `silver_track_metadata_evidence` rows with `source = 'audio_analysis'` and re-run
consensus for those tracks.
