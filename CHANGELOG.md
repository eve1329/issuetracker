# Changelog

All notable changes to this local IssueTracker fork are documented in this file.

## 0.2.14 - 2026-08-07

- Send Feishu notifications only for new external Issues. Internal Issues are excluded from new and legacy pending Feishu delivery queues.
- Reply once to an internal Issue that remains open without a non-author comment after the configured delay from its creation time.
- Migrate prior first-response reply state by queueing this week's unanswered internal Issues while keeping older overdue history suppressed.

## 0.2.13 - 2026-08-07

- Fix GitCode internal Issue auto-replies by sending the required form-encoded comment body.

## 0.2.12 - 2026-08-06

- Make the internal Issue auto-reply delay configurable in hours, defaulting to 24 hours from the first non-author comment and allowing `0` for the next successful sync.

## 0.2.11 - 2026-08-06

- Optionally reply once to internal Issues after the first non-author comment is detected, with a configurable template and durable retry state.
- Keep external Issues on the existing local and Feishu notification path without automatic comment write-back.

## 0.2.10 - 2026-08-01

- Stabilize the same-day Feishu delivery-reconciliation coverage across CI runner time zones.

## 0.2.9 - 2026-08-01

- Record each successful Feishu webhook delivery by Issue key, timestamp, and author type; keep failed or unrecorded deliveries pending for retry on the next successful sync.
- Split large Feishu deliveries into durable batches, recording each successful batch before sending the next one.
- Directly backfill same-day internal Issues that were already synchronized before delivery tracking existed, without replaying historical internal Issues.

## 0.2.8 - 2026-08-01

- Prevent overlapping startup, interval, ribbon, and command sync triggers from creating duplicate progress notices or racing to write the same generated file.
- Treat a concurrent file-creation collision as an update when the expected file has already appeared.
- Notify about newly discovered internal and external Issues, identify the author type in local and Feishu notifications, and migrate the prior local-notification preference without changing its saved value.

## 0.2.7 - 2026-07-31

- Move the sync progress notice layout from static inline assignments into packaged CSS classes so it passes the Obsidian Community static-style validation.

## 0.2.6 - 2026-07-31

- Notify about newly discovered external Issues with an Obsidian notice, using a durable silent baseline to avoid first-sync and retry duplicates.
- Add an optional Feishu group-bot webhook that sends linked Issue summaries directly from the running Obsidian plugin.
- Keep notification state unchanged when a sync is degraded or its state file cannot be persisted.

## 0.2.5 - 2026-07-30

- Replace the CSV ledger with the native-hyperlink XLSX ledger; a successful Excel refresh removes the retired CSV output.
- Populate first response time from the first non-author, non-system Issue comment, retaining only the selected timestamp and check time rather than comment content.
- Show a dark high-contrast XLSX row for a tracked Issue that transitions from open to closed during the current sync, and retain the previous state baseline if Excel writing fails so a retry is still highlighted.
- Keep historical closed Issues out of first-time ledger rows while reusing their internal-reference and collaborator evidence for same-account identity checks in ledger and daily-report counts.
- Treat `IR` / `SR` references and internal workflow markers, including `【bug】` and plain `门禁测试`, as internal-person evidence even when an author account is present.
- Apply the confirmed member directory and internal title evidence consistently to ledger, daily-report, and AI-brief external counts.
- Generate `internal-member-identity-review.md` on every sync, grouping accounts missing from the confirmed directory with the exact reason and related Issues.

## 0.2.4 - 2026-07-29

- Show a persistent in-Obsidian progress bar while IssueTracker synchronizes repositories, files, reports, and CSV/XLSX ledger outputs, with visible success, degraded, and failure completion states.
- Leave the ledger name blank for unmapped external accounts instead of copying an unverified API display name. Confirmed internal members continue to use the configured directory or API name.

## 0.2.3 - 2026-07-29

- Resolve the ledger author as internal or external before evaluating internal workflow references or title markers. Markers such as `【fix】` are now a fallback only when no author account is available, so they cannot turn a known external author into an internal record.

## 0.2.2 - 2026-07-28

- Mark ledger Issues as internal when their titles contain one of the configured internal workflow markers: `【fix】`, `【门禁测试】`, `【release】`, `【next】`, or `【需求】`.

## 0.2.1 - 2026-07-27

- Added a 13-column issue ledger with stable serial allocation, category/source classification, and retention of previously tracked issues after closure.
- Added raw-URL CSV and native-hyperlink XLSX ledger exports. The XLSX uses external hyperlink relationships instead of `HYPERLINK()` formulas for Tencent Docs imports.
- Added a configurable `YYYY-MM` issue-ledger start month, which resets ledger serial state when changed.
- Added a separate Markdown Issue-closure reminder with new-closure and current-closed sections, plus durable closure state for repeat-close detection.

## 0.2.0 - 2026-06-23

- Added GitLab API v4 routing for repo issue sync, organization repo discovery, and collaborator sync while preserving the current GitCode v5 behavior.
- Kept the Community README language switch on-page so the `中文` link stays within the same document instead of opening a separate file.

## 0.1.13 - 2026-06-22

- Raised `minAppVersion` to `0.12.16` so the settings tab matches the Obsidian Community preview requirement for `Setting.setName(...)`.
- Added a release regression test that keeps the declared minimum version aligned with the settings-tab APIs used by the source.

## 0.1.12 - 2026-06-22

- Fixed the Obsidian Community preview blockers by removing `Obsidian` branding from the manifest description.
- Replaced manual settings-page headings with `Setting(...).setHeading()` for reviewer-compatible UI structure.
- Preserved the declared `0.12.0` minimum app version by avoiding newer Obsidian APIs in timer cleanup and folder creation paths.

## 0.1.11 - 2026-06-22

- Republished the release on a fresh version number so Obsidian Community can rescan against a new GitHub tag.
- Kept the GitHub release workflow aligned with plain semantic tags and the required downloadable assets.

## 0.1.10 - 2026-06-22

- Repositioned the plugin as a GitCode-focused IssueTracker workspace with reporting and classification.
- Defaulted configuration to `https://gitcode.com` and `https://gitcode.com/api/v5`.
- Added GitCode organization and repository sync support.
- Added collaborator-based internal member matching plus manual whitelist support.
- Added issue classification rules for `bug`, `requirement`, and `unknown`.
- Added generated daily reports and AI briefs under `GitCode Issues/reports`.
- Hardened degraded-sync handling so cached notes and the previous successful sync marker survive partial failures.
- Updated README and user-facing plugin copy to match the current GitCode workflow.
