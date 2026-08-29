#!/bin/bash
# Detached TTS generator: cycles missing segments, 2.5min between attempts.
OUT=/home/z/my-project/video-assets/narration
IN=/home/z/my-project/scripts/narration.txt
deadline=$(( $(date +%s) + 3300 ))  # give up after 55 min

while [ $(date +%s) -lt $deadline ]; do
  alldone=1
  while IFS='|' read -r name text; do
    [ -z "$name" ] && continue
    f="$OUT/$name.mp3"
    [ -s "$f" ] && continue
    alldone=0
    echo "[$(date +%T)] trying $name"
    timeout 120 z-ai tts -i "$text" -o "$f" --voice jam --speed 1.0 --format mp3 >> "$OUT/tts.log" 2>&1
    if [ -s "$f" ]; then echo "[$(date +%T)] $name OK ($(stat -c%s "$f")B)"; else rm -f "$f"; fi
    sleep 12
  done < "$IN"
  [ "$alldone" = "1" ] && { echo "[$(date +%T)] ALL DONE"; break; }
  sleep 150
done
echo "[$(date +%T)] loop exit"
for f in $OUT/SEG*.mp3; do [ -f "$f" ] && echo "$(basename $f) $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$f")"; done
