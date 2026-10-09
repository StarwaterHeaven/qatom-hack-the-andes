#!/usr/bin/env bash
# Builds the HLS ladder (1080p/720p/480p, 4 s segments) and the poster frame into ./public.
# Default source: NASA "ISS 4K Crew Earth Observations" (US Government work, public domain), ~344 MB.
# Needs ffmpeg and curl. Usage: bash build-hls.sh [path-to-your-own-video]
set -euo pipefail
cd "$(dirname "$0")"
SRC="${1:-ISS-4K-Crew-Earth-Observations.mov}"
if [ ! -f "$SRC" ]; then
  echo "==> downloading the NASA source (about 344 MB, resumable)"
  curl -L -C - --retry 5 -o "$SRC" "https://archive.org/download/NASA-Ultra-High-Definition/ISS%204K%20Crew%20Earth%20Observations.mov"
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg is required (macOS: brew install ffmpeg)"; exit 1; }
HLS=public/hls; rm -rf "$HLS"; mkdir -p "$HLS/1080p" "$HLS/720p" "$HLS/480p"
encode () { # name height vbitrate maxrate bufsize
  echo "==> encoding $1"
  ffmpeg -hide_banner -loglevel error -stats -y -i "$SRC" -map 0:v:0 -map 0:a? \
    -c:v libx264 -preset veryfast -profile:v high -level 4.1 -pix_fmt yuv420p \
    -vf "scale=-2:$2:flags=lanczos" -b:v "$3" -maxrate "$4" -bufsize "$5" \
    -g 48 -keyint_min 48 -sc_threshold 0 -c:a aac -b:a 128k -ac 2 \
    -f hls -hls_time 4 -hls_playlist_type vod -hls_flags independent_segments \
    -hls_segment_filename "$HLS/$1/seg_%03d.ts" "$HLS/$1/index.m3u8"
}
encode 1080p 1080 5000k 5350k 7500k
encode 720p   720 2800k 2996k 4200k
encode 480p   480 1400k 1498k 2100k
cat > "$HLS/master.m3u8" <<'M3U'
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=5500000,AVERAGE-BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,AVERAGE-BANDWIDTH=2800000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,AVERAGE-BANDWIDTH=1400000,RESOLUTION=854x480
480p/index.m3u8
M3U
ffmpeg -hide_banner -loglevel error -y -ss 8 -i "$SRC" -frames:v 1 -vf "scale=1280:-2" -q:v 3 public/poster.jpg
echo "==> done: $(find "$HLS" -type f | wc -l | tr -d ' ') files in $HLS"
BIG=$(find "$HLS" -type f -size +24M | wc -l | tr -d ' ')
[ "$BIG" = "0" ] || { echo "!! $BIG file(s) exceed Cloudflare's 25 MiB static-asset limit; lower the bitrate"; exit 1; }
