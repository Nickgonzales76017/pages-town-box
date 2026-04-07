# Town in a Box

> Meetings, hotlines, issues, and archives — a digital civic OS from one repo

## Quick Start

```bash
make setup              # wire hooks + verify binaries
cp ~/my-recording.wav input/
git add input/ && git commit -m "add recording"
# hooks run automatically → site/ updated
git push                # GitHub Pages deploys
```

## Architecture

```
input/  →  git commit  →  .githooks/post-commit (Bonfyre pipeline)
                              ↓
                         artifacts/  (JSON manifests, transcripts, briefs)
                              ↓
                         site/  →  git push  →  GitHub Pages
```

## Git Hooks

| Hook | Purpose |
|------|---------|
| `post-commit` | Detect new files in `input/`, run full Bonfyre pipeline, regenerate `site/` |
| `prepare-commit-msg` | Auto-describe what the pipeline processed |
| `pre-push` | Validate all artifacts are current and site is built |
| `post-merge` | Rebuild site after pulling new content |
| `post-checkout` | Rebuild site after switching branches |

## Powered By

[Bonfyre](https://github.com/Nickgonzales76017/bonfyre) — 47 composable C11 binaries. ~2.1 MB total.

