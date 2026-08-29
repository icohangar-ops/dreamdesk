#!/bin/bash
# Assemble the DreamDesk demo video — caption/ambient edition (~2:55).
# Consumes: cards, captions, floor-tour-25fps.mp4. Produces: download/dreamdesk-demo-3min.mp4
set -euo pipefail
A=/home/z/my-project/video-assets
C=$A/cards
W=$A/work
OUT=/home/z/my-project/download/dreamdesk-demo-3min.mp4
mkdir -p "$W" /home/z/my-project/download

TOTAL=173   # 12+14+18+54+45+15+15
ENC="-c:v libx264 -preset veryfast -crf 19 -pix_fmt yuv420p -r 25"

block () {  # $1=png $2=dur $3=out  (card with slow zoom + fades)
  local frames=$(python3 -c "print(int($2*25))")
  ffmpeg -y -v error -i "$1" -f lavfi -t "$2" -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]scale=2016:1134,zoompan=z='min(1.0+0.0022*on,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=25,fade=t=in:st=0:d=0.5,fade=t=out:st=$(python3 -c "print(max(0,$2-0.55))"):d=0.55,format=yuv420p[v]" \
    -map "[v]" -map 1:a $ENC -c:a aac -b:a 128k -shortest "$3"
}

cut_block () {  # $1="ss:capfile ..."  $2="ss secs ss secs ..." $3=dur $4=out
  local caps="$1" spec="$2" total=$3 out=$4
  rm -f "$W/${out##*/}.parts.txt"; : > "$W/${out##*/}.parts.txt"
  local i=0
  python3 - "$spec" "$total" > "$W/cuts.txt" << 'PYEOF'
import sys
spec, total = sys.argv[1], float(sys.argv[2])
cuts = []
toks = spec.split()
for j in range(0, len(toks), 2):
    cuts.append((float(toks[j]), float(toks[j+1])))
acc = 0.0
for ss, secs in cuts:
    if acc >= total: break
    take = min(secs, total - acc)
    print(f"{ss:.3f} {take:.3f}")
    acc += take
PYEOF
  while read -r ss secs; do
    i=$((i+1))
    cap=$(echo "$caps" | cut -d' ' -f$i)
    if [ -n "$cap" ] && [ "$cap" != "-" ]; then
      ffmpeg -y -v error -ss "$ss" -t "$secs" -i $A/raw/floor-tour-25fps.mp4 -i "$cap" -f lavfi -t "$secs" -i anullsrc=r=48000:cl=stereo \
        -filter_complex "[0:v]scale=1920:1080,fps=25[bg];[1:v]format=rgba,fade=t=in:st=0.4:d=0.5:alpha=1,fade=t=out:st=$(python3 -c "print(max(0,$secs-0.9))"):d=0.9:alpha=1[cap];[bg][cap]overlay=0:0,format=yuv420p[v]" \
        -map "[v]" -map 2:a $ENC -c:a aac -b:a 128k -shortest "$W/cut_$i.mp4"
    else
      ffmpeg -y -v error -ss "$ss" -t "$secs" -i $A/raw/floor-tour-25fps.mp4 -f lavfi -t "$secs" -i anullsrc=r=48000:cl=stereo \
        -filter_complex "[0:v]scale=1920:1080,fps=25,format=yuv420p[v]" \
        -map "[v]" -map 1:a $ENC -c:a aac -b:a 128k -shortest "$W/cut_$i.mp4"
    fi
    echo "file '$W/cut_$i.mp4'" >> "$W/${out##*/}.parts.txt"
  done < "$W/cuts.txt"
  ffmpeg -y -v error -f concat -safe 0 -i "$W/${out##*/}.parts.txt" -c copy "$W/pre_${out##*/}"
  ffmpeg -y -v error -i "$W/pre_${out##*/}" -f lavfi -t "$total" -i anullsrc=r=48000:cl=stereo \
    -filter_complex "[0:v]fade=t=in:st=0:d=0.35,fade=t=out:st=$(python3 -c "print(max(0,$total-0.55))"):d=0.55,format=yuv420p[v]" \
    -map "[v]" -map 1:a $ENC -c:a aac -b:a 128k -shortest "$4"
}

echo "== cards =="
block $C/card1-title.png    12 "$W/b1.mp4"
block $C/card2-market.png   14 "$W/b2.mp4"
block $C/card3-pipeline.png 18 "$W/b3.mp4"

echo "== tour with captions =="
cut_block "$C/caption-1.png $C/caption-2.png $C/caption-3.png $C/caption-4.png" \
          "5:14 44:13 106:14 119:13" 54 "$W/b4.mp4"
cut_block "$C/caption-5.png $C/caption-6.png $C/caption-7.png" \
          "84:20 132:13 146:12"      45 "$W/b5.mp4"

echo "== cards 2 =="
block $C/card4-evidence.png 15 "$W/b6.mp4"
block $C/card5-outro.png    15 "$W/b7.mp4"

echo "== concat =="
: > "$W/concat_all.txt"
for b in b1 b2 b3 b4 b5 b6 b7; do echo "file '$W/$b.mp4'" >> "$W/concat_all.txt"; done
ffmpeg -y -v error -f concat -safe 0 -i "$W/concat_all.txt" -c copy "$W/video_master.mp4"

echo "== ambient bed =="
ffmpeg -y -v error -i "$W/video_master.mp4" \
  -f lavfi -t 173 -i "aevalsrc='0.040*sin(2*PI*55*t)+0.030*sin(2*PI*110.3*t)+0.020*sin(2*PI*164.8*t)+0.014*sin(2*PI*220.5*t)':s=48000:d=173,tremolo=f=0.08:d=0.42,lowpass=f=650,afade=t=in:st=0:d=6,afade=t=out:st=165:d=8" \
  -filter_complex "[1:a]volume=0.9,alimiter=limit=0.8[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "$OUT"

echo "== result =="
ffprobe -v quiet -show_entries format=duration,size -of csv=p=0 "$OUT"
echo "saved $OUT"
