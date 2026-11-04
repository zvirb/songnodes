# GOV rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| GOV-001 | The design system MUST have a single semantic version number (MAJOR.MINOR.PATCH) stored in tokens.json and exposed as SongNodes.version in bundle.js. | lint | Read tokens.json "version" and SongNodes.version; both exist and parse as MAJOR.MINOR.PATCH. |
| GOV-002 | The build MUST fail when the version in tokens.json differs from SongNodes.version. | lint | Run the build with mismatched versions; it exits non-zero. |
| GOV-003 | A change that renames or removes a token, class, component, prop or helper, changes a token meaning, or moves a raw enum to a different status MUST bump the MAJOR version. | judgement | Compare releases; any such change has a MAJOR bump. |
| GOV-004 | A change that adds a token, class, component, prop, icon, theme, helper or status mapping MUST bump the MINOR version. | judgement | Compare releases; any additive change without a MAJOR change has a MINOR bump. |
| GOV-005 | A change to a value that does not change meaning (contrast fix, spacing tweak, copy fix, bug fix) MUST bump the PATCH version. | judgement | Compare releases; value-only changes have a PATCH bump. |
| GOV-006 | A token, class, component, prop or helper MUST be kept as an alias under its old name for at least one minor release before it is removed. | judgement | For each removal, check the old name was aliased in a prior minor release (token alias in tokens.json, CSS selector list for classes). |
| GOV-007 | A deprecated item MUST be marked in its usage note with the release that deprecated it and the release that removes it. | judgement | Each alias has a usage note giving deprecation and removal releases. |
| GOV-008 | A deprecation MUST be listed in the change log. | judgement | Each deprecated item appears in a Deprecated entry. |
| GOV-009 | Consumers MUST pin an exact design system version. | judgement | Consumer configuration references one exact version. |
| GOV-010 | SongNodes MUST record the synced design system version in frontend/src/styles/design-system/VERSION. | lint | Check the VERSION file exists after sync and holds the synced version. |
| GOV-011 | Export schemas MUST be versioned separately through schemaVersion in JSON exports, using the same versioning rules. | judgement | JSON exports carry schemaVersion bumped per the same rules. |
| GOV-012 | Each change log entry MUST give the version, the date in Melbourne time, one line per change prefixed Added, Changed, Deprecated, Removed or Fixed, and the decision record if any, with newest entries first. | judgement | Inspect the change log for entry fields, prefixes and ordering. |
| GOV-013 | Every choice that a reasonable person could make differently MUST have a decision record. | judgement | Each such choice has a DR in the decision records. |
| GOV-014 | Decision records MUST be append-only; a change MUST be made by a new record that supersedes the old one, and the old record status MUST be updated. | judgement | No record is edited except its status; superseding records exist for changes. |
| GOV-015 | Rules MUST be derived in this order of precedence: the owner decisions and past corrections, then what existing artifacts already do, then correct SongNodes code, then platform standards, then taste. | judgement | For a new rule, confirm no higher-precedence source contradicts it. |
| GOV-016 | A rule derived from existing artifacts SHOULD fit the rule that reproduces them and SHOULD NOT invent a new value. | judgement | The rule reproduces the existing artifact behaviour it was fitted to. |
| GOV-017 | A rule that rests on taste MUST be recorded as an open question when it matters. | judgement | Taste-based rules appear in the open questions register. |
| GOV-018 | The design system artifact MUST be the source, and downstream copies MUST NOT be edited. | judgement | Downstream files are identical to the artifact files after sync. |
| GOV-019 | Generated design system files MUST be regenerated with the build scripts (build_tokens.py then build_bundle.py). | lint | Run both scripts; the committed generated files are unchanged. |
| GOV-020 | SongNodes MUST consume tokens.css, components/bundle.css, components/bundle.js, fonts/ and source/types/*.d.ts as copies placed in frontend/src/styles/design-system/ by scripts/sync-design-system.sh. | lint | Run the sync script; the listed files are present in the target folder. |
| GOV-021 | The sync script MUST fail when the version has gone backwards. | lint | Run sync against a lower version; it exits non-zero. |
| GOV-022 | SongNodes main.tsx MUST import tokens.css first, then bundle.css, then app CSS modules. | judgement | Inspect import order in main.tsx. |
| GOV-023 | SongNodes React components MUST mirror the markup and classes of the design system and MUST import helpers from a typed wrapper around bundle.js. | judgement | Components use design system classes; helper imports go through the wrapper. |
| GOV-024 | Other artifacts MUST load the three shared files and fonts from the artifact own files and MUST NOT load them from a CDN. | lint | Search artifact sources for CDN URLs referencing these files; none found. |
| GOV-025 | A sync MUST be a normal pull request with the version bump in the title and a change log excerpt in the body. | judgement | Inspect the sync pull request title and body. |
| GOV-026 | App code outside styles/design-system/ MUST NOT contain a hex, rgb() or named colour, except third-party brand assets. | lint | stylelint color-no-hex and declaration-property-value-disallowed-list, plus an ESLint rule banning hex strings in .tsx; zero violations. |
| GOV-027 | Source files under src/ MUST NOT contain emoji outside comments. | lint | grep -P over src/ for U+1F300-1FAFF and U+2600-27BF; no match outside comments. |
| GOV-028 | Application code MUST NOT call alert or confirm. | lint | ESLint no-alert reports no call. |
| GOV-029 | Every route in every theme MUST have no serious or critical accessibility violation. | lint | axe-core in Playwright on every route and theme; zero serious or critical violations. |
| GOV-030 | Every listed colour pair MUST meet 4.5:1 contrast, or 3:1 for large text and UI edges. | lint | build_tokens.py contrast report lists no pair below threshold. |
| GOV-031 | Visual snapshots of every preview.html in dark, light and booth, and of key routes, MUST NOT differ above threshold without an approved update. | lint | Playwright snapshot comparison passes. |
| GOV-032 | The pre-release checklist in the accessibility and quality section MUST be run manually before each minor or major release. | judgement | Completed checklist exists for the release. |
| GOV-033 | An exception request MUST be made in the open questions register and MUST state the rule, the reason, the scope and an expiry date or release. | judgement | Each request row has all four fields. |
| GOV-034 | The owner MUST approve or decline each exception request. | judgement | Each request has a recorded decision by the owner. |
| GOV-035 | An approved exception MUST have an EX-NNN row in the register and a code comment "/* design-system exception EX-NNN */" at the site. | lint | grep code for exception comments; each EX id has a register row and vice versa. |
| GOV-036 | An exception MUST expire, and at expiry the code MUST conform or a new decision record MUST change the rule. | judgement | No expired exception remains in code. |
| GOV-037 | Third-party widgets in the Platform section MUST NOT require an exception request. | judgement | Third-party widgets are not listed in the exceptions register. |
