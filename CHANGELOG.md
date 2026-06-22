# Changelog

All notable changes to this local IssueTracker fork are documented in this file.

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
