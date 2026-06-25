---
name: release
description: Release html-viewer by analyzing changes, bumping the version, and pushing
argument-hint: [patch|minor|major|<version>]
---

# Release html-viewer

Analyze changes since the last release, suggest a version bump, and release using `./release.sh`.

## Usage

```
/release
/release patch
/release minor
/release major
/release <version>
```

## Instructions

When the user invokes this skill:

### Prerequisites

1. **Verify on main branch** — if not, inform the user and stop
2. **Verify no uncommitted changes** to tracked files — untracked files are fine
3. `./release.sh` bumps `package.json` and `main.js` automatically — do not edit them manually

### If an argument is provided (patch, minor, major, or explicit version):

Skip change analysis and pass the argument directly to `./release.sh`:

1. Run `./release.sh <argument>`
2. Report the result to the user

### If NO argument is provided:

1. **Get the current version** by running `./release.sh` (with no args, it prints the current version)
2. **Find the last tag**: `git tag --list 'v*' --sort=-v:refname | head -1`
3. **Analyze changes since last tag**:
   - Run `git log <last-tag>..HEAD --oneline`
   - Run `git diff <last-tag>..HEAD -- main.js preload.js renderer/`
   - If no previous tag exists, this is the initial release
4. **Suggest version bump** based on changes:
   - **Patch** (x.y.Z): Bug fixes, internal changes, documentation
   - **Minor** (x.Y.0): New features — new flags, new UI, new behaviors
   - **Major** (X.0.0): Breaking changes — removed features, changed CLI interface
5. **Show analysis to user**:
   - Display current version
   - Summarize changes since last tag
   - Recommend bump type with reasoning
   - Wait for user to confirm or choose differently
6. Once confirmed, run `./release.sh <bump-type-or-version>`

## Change Analysis Guidelines

### Patch
- Bug fixes
- Documentation updates
- Internal refactoring without behavior change
- Style/layout fixes

### Minor
- New CLI flags or options
- New window behaviors (nav, shrink, resize)
- New title bar features
- New IPC handlers

### Major
- Removed CLI flags or changed their meaning
- Changed default window behavior
- Breaking changes to how files are loaded

## Error Handling

- If `./release.sh` fails, report the error to the user
- If the tag already exists, `./release.sh` will report it
- If not on main or working tree is dirty, `./release.sh` will catch this early
