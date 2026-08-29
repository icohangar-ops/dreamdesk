#!/bin/bash
# Foreground TTS retry loop with time budget. Usage: tts-fg.sh [budget_seconds]
OUT=/home/z/my-project/video-assets/narration
IN=/home/z/my-project/scripts/narration.txt
BUDGET=${1:-540}
end=$(( $(date +%s) + BUDGET ))

while [ $(date +%s) -lt $end ]; do
  alldone=1
  while IFS='|' read -r name text; do
    [ -z "$name" ] && continue
    f="$OUT/$name.mp3"
    [ -s "$f" ] && continue
    alldone=0
    echo "[$(date +%T)] $name"
    timeout 100 z-ai tts -i "$text" -o "$f" --voice jam --speed 1.0 --format mp3 2>&1 | grep -oE "(OK|Error[^\"]*)" | head -1 || true
    [ -s "$f" ] && echo "[$(date +%T)] $name OK $(stat -c%s "$f")B"
    [ -s "$f" ] || rm -f "$f"
    [ $(date +%s) -ge $end ] && break
    sleep 45
  done < "$IN"
  [ "$alldone" = "1" ] && { echo ALL_DONE; break; }
done

echo "===STATUS $(date +%T)==="
for i in 1 2 3 4 5 6 7; do
  f="$OUT/SEG$i.mp3"
  if [ -s "$f" ]; then echo "SEG$i $(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$f")s"; else echo "SEG$i MISSING"; fi
done
