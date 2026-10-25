# MusicBrainz Data Licensing

This project utilizes data from MusicBrainz (MetaBrainz Foundation). The data is split into two main licensing categories.

## CC0 (Public Domain Dedication)
The core database (`mbdump`), including the canonical lookup data, is licensed under the CC0 1.0 Universal Public Domain Dedication. This covers tables such as `artist`, `recording`, `release`, `label`, `isrc`, and `track`.

## Non-Commercial (CC BY-NC-SA 3.0)
Data such as tag votes, ratings, derived dumps, and cover art are licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported license.

**Rule:** Any non-commercial data must only be loaded into a separate, droppable `ref_mb_nc` schema and must never be written into the `silver` data layer without explicitly recorded license evidence. At present, non-commercial data is not loaded.

## Credit
As required by MusicBrainz, we acknowledge their contribution:

> This application uses data from MusicBrainz, which is made available under the CC0 1.0 Universal Public Domain Dedication and the Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported license.
