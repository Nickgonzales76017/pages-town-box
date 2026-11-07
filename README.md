# Town in a Box

> Meetings, hotlines, issues, and archives — a digital civic OS from one repo


## Aurekai / Bonfÿre: product contract

| | This experience |
|---|---|
| **Audience / value** | Local civic organizations: Connect meeting files, hotline reports and community issues to their sources |
| **Project** | A public-facing, source-oriented Aurekai workflow over files and reviewable records |
| **Technical scope** | GitHub Pages interface and repository-based intake; inspect the actual Actions/workflow before claiming processing or deployment |
| **Maturity** | Earlier civic workflow example; not an official municipal system or verified incident record |
| **Acceptance** | Follow the repository's instructions and verify actual generated files, tests, rights and destination readback |

**Aurekai** is the digital operating business and public distribution network; **Bonfÿre** is the reusable software, source/authority and verified-work engine. [Business and technical model](https://github.com/Nickgonzales76017/bonfyre/blob/main/docs/aurekai-bonfyre-model.md).

## Historical shared-pipeline figures (not current-site acceptance)

The inherited metrics below describe an earlier shared Bonfÿre/HCP pipeline snapshot; they are **not measurements of this Pages experience**, proof of an installed native runtime, or a guarantee of model accuracy. Verify the exact model, code revision, fixtures and executed workflow for current claims.

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

### Browser-first GitHub-native intake

1. Open the live Pages app.
2. Choose the civic route (`meetings`, `issues`, or `hotline`).
3. Select a file and download the intake-ready renamed copy.
4. Open the matching GitHub folder from the app and upload that file with GitHub's own web UI.
5. Commit to `main`; the Bonfyre Actions runtime processes it and republishes the site.

### Local repo workflow

```bash
make setup
cp ~/my-recording.wav input/meetings/
git add input/ && git commit -m "add civic recording"
git push
```

## Architecture

```
browser prepare  →  GitHub web upload  →  input/
                                          ↓
                             reusable Bonfyre runtime workflow
                                          ↓
                         artifacts/ + site/job.json + site/summary.json
                                          ↓
                                   site/  →  GitHub Pages
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
