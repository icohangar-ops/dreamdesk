#!/bin/bash
# Persistent TTS generation: loops over missing segments until all exist
OUT=/home/z/my-project/video-assets/narration
IN=/home/z/my-project/scripts/narration.txt

for round in 1 2 3 4 5 6; do
  missing=0
  while IFS='|' read -r name text; do
    [ -z "$name" ] && continue
    f="$OUT/$name.mp3"
    if [ -s "$f" ]; then continue; fi
    missing=1
    echo "[$(date +%T)] round $round: $name"
    z-ai tts -i "$text" -o "$f" --voice jam --speed 1.0 --format mp3 2>&1 | tail -1
    if [ -s "$f" ]; then echo "[$(date +%T)] $name OK"; fi
    sleep 20
  done < "$IN"
  [ "$missing" = "0" ] && break
  sleep 30
done

echo "===DONE==="
for f in $OUT/SEG*.mp3; do
  [ -f "$f" ] && echo "$(basename $f) $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$f")"
done
