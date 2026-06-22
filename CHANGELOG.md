# Changelog

All notable changes to this local IssueTracker fork are documented in this file.

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
