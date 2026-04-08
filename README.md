# Town in a Box

> Meetings, hotlines, issues, and archives — a digital civic OS from one repo


## Pipeline Intelligence

| Capability | Detail |
|---|---|
| Transcription quality | **0.997** (HCP v3.2, tiny q5_0, 29 MB model) |
| Hallucination detection | **9 layers** — 0.09% error rate (1 in 1,096 segments) |
| Pipeline latency | **< 8 ms** per stage |
| Total binary size | **~2.1 MB** (48 static C11 binaries) |
| JSON compression | **9.3%** ratio with O(1) field reads (Lambda Tensors) |
| OpenAI compatibility | Drop-in via **bonfyre-proxy** (`/v1/audio/transcriptions`, `/v1/chat/completions`) |
| Tests passing | **167** |

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

[Bonfyre](https://github.com/Nickgonzales76017/bonfyre) — 48 composable C11 binaries. ~2.1 MB total.

