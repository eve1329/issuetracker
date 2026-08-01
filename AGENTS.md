# Release Rules

- A version release or other external plugin publication is incomplete until the exact released commit has been merged or fast-forwarded into `main` and pushed to `origin/main`.
- Do not treat a feature-branch push, a GitHub tag, or a GitHub Release by itself as a completed release. Verify that `main` contains the release commit and that its `manifest.json` version matches the release tag.
- Prefer merging or fast-forwarding into `main` before publishing the version tag, so the release artifact, default branch, and Obsidian Community metadata all refer to the same version.
- This rule does not override an explicit user instruction to keep a change branch-local, open only a PR, or avoid merging `main`.
- Every new user-facing small feature requires a new patch version. Increment the patch component (for example, `0.2.7` to `0.2.8`) and update `package.json`, `manifest.json`, `versions.json`, and `CHANGELOG.md` together before committing; never reuse an already published version.
