#!/bin/sh
set -eu

: "${CHANGED_FILES_FILE:?CHANGED_FILES_FILE is required}"
: "${DEPLOY_PATH:=site}"

mkdir -p artifacts "${DEPLOY_PATH}" "${DEPLOY_PATH}/meetings" "${DEPLOY_PATH}/issues"

while IFS= read -r f; do
  [ -f "$f" ] || continue

  base=$(basename "$f" | sed 's/\.[^.]*$//')
  ext="${f##*.}"
  dir=$(dirname "$f")
  category=$(basename "$dir")

  case "$ext" in
    wav|mp3|m4a|ogg|flac|webm)
      bonfyre-media-prep "$f" --out "artifacts/${base}.prep.json"
      bonfyre-transcribe "artifacts/${base}.prep.json" --out "artifacts/${base}.transcript.json"
      bonfyre-brief "artifacts/${base}.transcript.json" --out "artifacts/${base}.brief.json"
      bonfyre-tag "artifacts/${base}.brief.json" --out "artifacts/${base}.tags.json"
      if command -v bonfyre-embed >/dev/null 2>&1 && command -v bonfyre-vec >/dev/null 2>&1; then
        bonfyre-embed "artifacts/${base}.tags.json" --out "artifacts/${base}.embed.json"
        bonfyre-vec "artifacts/${base}.embed.json" --insert-db "artifacts/civic.db"
      fi
      bonfyre-index "artifacts/${base}.tags.json" --db "artifacts/civic.db"
      if [ "$category" = "meetings" ]; then
        bonfyre-render "artifacts/${base}.brief.json" --template meeting --out "${DEPLOY_PATH}/meetings/${base}.html"
      fi
      ;;
    json)
      bonfyre-brief "$f" --out "artifacts/${base}.brief.json"
      bonfyre-tag "artifacts/${base}.brief.json" --out "artifacts/${base}.tags.json"
      if command -v bonfyre-embed >/dev/null 2>&1 && command -v bonfyre-vec >/dev/null 2>&1; then
        bonfyre-embed "artifacts/${base}.tags.json" --out "artifacts/${base}.embed.json"
        bonfyre-vec "artifacts/${base}.embed.json" --insert-db "artifacts/civic.db"
      fi
      bonfyre-index "artifacts/${base}.tags.json" --db "artifacts/civic.db"
      if [ "$category" = "meetings" ]; then
        bonfyre-render "artifacts/${base}.brief.json" --template meeting --out "${DEPLOY_PATH}/meetings/${base}.html"
      fi
      ;;
    md|txt)
      bonfyre-tag "$f" --out "artifacts/${base}.tags.json"
      bonfyre-embed "artifacts/${base}.tags.json" --out "artifacts/${base}.embed.json"
      bonfyre-index "artifacts/${base}.tags.json" --db "artifacts/civic.db"
      ;;
  esac
done < "$CHANGED_FILES_FILE"

bonfyre-emit artifacts/ --out "${DEPLOY_PATH}/" --format html
