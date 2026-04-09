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
      echo "Skipping raw audio on portable runner: $f"
      ;;
    json)
      bonfyre-render artifact "$f" "artifacts/${base}" --title "$base"
      target_dir="${DEPLOY_PATH}/${category}"
      mkdir -p "$target_dir"
      bonfyre-emit "artifacts/${base}/brief" --format html --out "${target_dir}/${base}.html"
      ;;
    md|txt)
      bonfyre-render artifact "$f" "artifacts/${base}" --title "$base"
      bonfyre-emit "artifacts/${base}/brief" --format html --out "${DEPLOY_PATH}/${base}.html"
      ;;
  esac
done < "$CHANGED_FILES_FILE"
