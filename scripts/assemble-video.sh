#!/bin/bash
# Assemble the DreamDesk 3-minute demo video.
# Consumes: video-assets/cards/card*.png, video-assets/raw/floor-tour.webm,
#           video-assets/narration/SEG1..7.mp3
# Produces: download/dreamdesk-demo-3min.mp4
set -euo pipefail

A=/home/z/my-project/video-assets
N=$A/narration
C=$A/cards
W=$A/work
OUT=/home/z/my-project/download/dreamdesk-demo-3min.mp4
mkdir -p "$W" /home/z/my-project/download

dur() { ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$1"; }

D1=$(dur $N/SEG1.mp3); D2=$(dur $N/SEG2.mp3); D3=$(dur $N/SEG3.mp3)
D4=$(dur $N/SEG4.mp3); D5=$(dur $N/SEG5.mp3); D6=$(dur $N/SEG6.mp3); D7=$(dur $N/SEG7.mp3)

# block durations = narration + pad
B1=$(python3 -c "print(f'{$D1+1.2:.3f}')")
B2=$(python3 -c "print(f'{$D2+1.0:.3f}')")
B3=$(python3 -c "print(f'{$D3+1.0:.3f}')")
B4=$(python3 -c "print(f'{$D4+1.6:.3f}')")
B5=$(python3 -c "print(f'{$D5+1.2:.3f}')")
B6=$(python3 -c "print(f'{$D6+1.0:.3f}')")
B7=$(python3 -c "print(f'{$D7+2.6:.3f}')")
TOTAL=$(python3 -c "print(f'{$B1+$B2+$B3+$B4+$B5+$B6+$B7:.3f}')")

echo "narration: $D1 $D2 $D3 $D4 $D5 $D6 $D7"
echo "blocks:    $B1 $B2 $B3 $B4 $B5 $B6 $B7  => total $TOTAL s"

# ---------- narration start offsets ----------
S1=0.4
S2=$(python3 -c "print(f'{$B1+0.4:.3f}')")
S3=$(python3 -c "print(f'{$B1+$B2+0.4:.3f}')")
S4=$(python3 -c "print(f'{$B1+$B2+$B3+0.4:.3f}')")
S5=$(python3 -c "print(f'{$B1+$B2+$B3+$B4+0.4:.3f}')")
S6=$(python3 -c "print(f'{$B1+$B2+$B3+$B4+$B5+0.4:.3f}')")
S7=$(python3 -c "print(f'{$B1+$B2+$B3+$B4+$B5+$B6+0.4:.3f}')")

# ---------- helper: card block with slow zoom + fades ----------
card_block () {  # $1=png $2=dur $3=out
  local frames=$(python3 -c "print(int($2*25))")
  ffmpeg -y -v error -loop 1 -framerate 25 -t "$2" -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
    -vf "scale=2016:1134,zoompan=z='min(1.0+0.0028*on/${frames},1.055)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=25,fade=t=in:st=0:d=0.45,fade=t=out:st=$(python3 -c "print(max(0,$2-0.5))"):d=0.5,format=yuv420p" \
    -c:v libx264 -preset medium -crf 18 -r 25 -c:a aac -b:a 128k -shortest "$3"
}

# ---------- helper: footage cut block ----------
cut_block () {  # $1=cut spec "ss:secs ss:secs ..." $2=dur $3=out
  local out=$3
  python3 - "$1" "$2" > "$W/cuts.txt" << 'PYEOF'
import sys
spec, total = sys.argv[1], float(sys.argv[2])
cuts = []
for pair in spec.split():
    ss, secs = pair.split(":")
    cuts.append((float(ss), float(secs)))
acc = 0.0
lines = []
for ss, secs in cuts:
    if acc >= total: break
    take = min(secs, total - acc)
    lines.append(f"{ss:.3f} {take:.3f}")
    acc += take
print("\n".join(lines))
PYEOF
  rm -f "$W/part_$(basename $3 .mp4)_.mp4"
  : > "$W/concat_$(basename $3 .mp4).txt"
  local i=0
  while read -r ss secs; do
    i=$((i+1))
    ffmpeg -y -v error -ss "$ss" -t "$secs" -i $A/raw/floor-tour.webm -f lavfi -t "$secs" -i anullsrc=r=48000:cl=stereo \
      -vf "scale=1920:1080,fps=25,format=yuv420p" \
      -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 128k -shortest "$W/cut_$i.mp4"
    echo "file '$W/cut_$i.mp4'" >> "$W/concat_$(basename $3 .mp4).txt"
  done < "$W/cuts.txt"
  ffmpeg -y -v error -f concat -safe 0 -i "$W/concat_$(basename $3 .mp4).txt" -c copy "$W/pre_$3"
  # crossfade-ish: simple fades on the assembled block
  ffmpeg -y -v error -i "$W/pre_$3" -f lavfi -i anullsrc=r=48000:cl=stereo \
    -vf "fade=t=in:st=0:d=0.35,fade=t=out:st=$(python3 -c "print(max(0,$2-0.5))"):d=0.5" \
    -c:v libx264 -preset medium -crf 18 -c:v libx264 -c:a aac -b:a 128k -shortest "$3"
}

echo "== card blocks =="
card_block $C/card1-title.png    "$B1" "$W/b1.mp4"
card_block $C/card2-market.png   "$B2" "$W/b2.mp4"
card_block $C/card3-pipeline.png "$B3" "$W/b3.mp4"

echo "== tour blocks =="
# B4: console -> council -> force cycle -> council votes
cut_block "5:9 44:10 106:10 119:9" "$B4" "$W/b4.mp4"
# B5: ledger live -> ledger after cycle -> console close
cut_block "86:13 133:11 146:7"    "$B5" "$W/b5.mp4"

echo "== card blocks 2 =="
card_block $C/card4-evidence.png "$B6" "$W/b6.mp4"
card_block $C/card5-outro.png    "$B7" "$W/b7.mp4"

echo "== concat video =="
: > "$W/concat_all.txt"
for b in b1 b2 b3 b4 b5 b6 b7; do echo "file '$W/$b.mp4'" >> "$W/concat_all.txt"; done
ffmpeg -y -v error -f concat -safe 0 -i "$W/concat_all.txt" -c copy "$W/video_master.mp4"

echo "== narration mix + ambient bed =="
ffmpeg -y -v error \
  -i $N/SEG1.mp3 -i $N/SEG2.mp3 -i $N/SEG3.mp3 -i $N/SEG4.mp3 -i $N/SEG5.mp3 -i $N/SEG6.mp3 -i $N/SEG7.mp3 \
  -f lavfi -t "$TOTAL" -i "aevalsrc='0.030*sin(2*PI*55*t)+0.022*sin(2*PI*110.3*t)+0.015*sin(2*PI*164.8*t)+0.010*sin(2*PI*220.5*t)':s=48000:d=$TOTAL,tremolo=f=0.09:d=0.4,lowpass=f=700,afade=t=in:st=0:d=5,afade=t=out:st=$(python3 -c "print($TOTAL-7)"):d=7" \
  -filter_complex "[0]adelay=${S1}000|${S1}000[a1];[1]adelay=${S2}000|${S2}000[a2];[2]adelay=${S3}000|${S3}000[a3];[3]adelay=${S4}000|${S4}000[a4];[4]adelay=${S5}000|${S5}000[a5];[5]adelay=${S6}000|${S6}000[a6];[6]adelay=${S7}000|${S7}000[a7];[a1][a2][a3][a4][a5][a6][a7][7]amix=inputs=8:normalize=0,volume=1.6,alimiter=limit=0.89[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "$OUT"

echo "== result =="
ffprobe -v quiet -show_entries format=duration,size -of csv=p=0 "$OUT"
echo "saved $OUT"
