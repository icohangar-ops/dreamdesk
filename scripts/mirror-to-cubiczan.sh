#!/usr/bin/env bash
# mirror-to-cubiczan.sh — mirror icohangar-ops/dreamdesk to Cubiczan/dreamdesk
#
# Usage:
#   CUBICZAN_PAT=ghp_xxx bash scripts/mirror-to-cubiczan.sh
#
# Security:
#   - PAT is passed via env var ONLY; never written to disk, never stored in git config.
#   - Push URL is one-shot (no remote is created); output is piped through redaction.
#
# Note: API responses are always buffered into variables before parsing —
#       `curl | grep -m1` under `set -o pipefail` races SIGPIPE (exit 23).
set -euo pipefail
trap 'echo "ERROR: script failed at line $LINENO"' ERR

PAT="${CUBICZAN_PAT:-}"
SRC="icohangar-ops/dreamdesk"
DST_OWNER="Cubiczan"
DST_REPO="dreamdesk"

[ -n "$PAT" ] || { echo "ERROR: set CUBICZAN_PAT env var"; exit 1; }
[[ "$PAT" =~ ^ghp_[A-Za-z0-9]{20,}$ ]] || { echo "ERROR: PAT format looks wrong"; exit 1; }

api() { curl -sS -H "Authorization: token $PAT" -H "Accept: application/vnd.github+json" "$@"; }

echo "== 1/5 identity check =="
RESP=$(api https://api.github.com/user)
LOGIN=$(printf '%s' "$RESP" | grep -m1 '"login"' | cut -d'"' -f4 || true)
[ "$LOGIN" = "$DST_OWNER" ] || { echo "ERROR: token belongs to '$LOGIN', expected '$DST_OWNER'"; exit 1; }
echo "OK: token is $DST_OWNER"

echo "== 2/5 fetch source metadata =="
RESP=$(api "https://api.github.com/repos/$SRC")
SRC_DESC=$(printf '%s' "$RESP" | grep -m1 '"description"' | sed -E 's/.*"description": "([^"]*)".*/\1/' || true)
DESC=$(printf '%s' "$SRC_DESC" | sed 's/"/\\"/g')
TOPICS=$(api "https://api.github.com/repos/$SRC/topics" | tr -d ' \n' | sed -E 's/.*"names":\[(.*)\].*/\1/')
echo "description: $DESC"
echo "topics: $TOPICS"

echo "== 3/5 ensure $DST_OWNER/$DST_REPO exists =="
CODE=$(api -o /dev/null -w "%{http_code}" "https://api.github.com/repos/$DST_OWNER/$DST_REPO")
if [ "$CODE" = "200" ]; then
  echo "already exists (HTTP 200)"
elif [ "$CODE" = "404" ]; then
  echo "creating repo (this may take a moment)..."
  api -X POST https://api.github.com/user/repos \
    -d "{\"name\":\"$DST_REPO\",\"description\":\"$DESC\",\"private\":false,\"has_wiki\":false,\"has_projects\":false,\"auto_init\":false}" >/dev/null
  CREATED=0
  for i in 1 2 3 4 5; do
    sleep 2
    CODE=$(api -o /dev/null -w "%{http_code}" "https://api.github.com/repos/$DST_OWNER/$DST_REPO")
    [ "$CODE" = "200" ] && { CREATED=1; break; }
  done
  [ "$CREATED" = "1" ] || { echo "ERROR: repo creation did not verify within 10s"; exit 1; }
  echo "repo created and reachable"
else
  echo "ERROR: unexpected HTTP $CODE while checking destination"; exit 1
fi

echo "== 4/5 mirror push (main + tags, one-shot URL) =="
PUSH_URL="https://$DST_OWNER:$PAT@github.com/$DST_OWNER/$DST_REPO.git"
PUSH_OK=0
for attempt in 1 2 3; do
  if git push "$PUSH_URL" main:main --tags --force 2>&1 | sed 's/ghp_[A-Za-z0-9]*/ghp_***REDACTED***/g'; then
    PUSH_OK=1
    break
  fi
  echo "push attempt $attempt failed, retrying in 5s..."
  sleep 5
done
[ "$PUSH_OK" = "1" ] || { echo "ERROR: push failed after 3 attempts"; exit 1; }

echo "== 5/5 topics + verify =="
if [ -n "$TOPICS" ]; then
  api -X PUT "https://api.github.com/repos/$DST_OWNER/$DST_REPO/topics" -d "{\"names\":[$TOPICS]}" >/dev/null
  echo "topics applied"
fi
RESP=$(api "https://api.github.com/repos/$DST_OWNER/$DST_REPO/branches/main")
REMOTE_SHA=$(printf '%s' "$RESP" | grep -m1 '"sha"' | cut -d'"' -f4 || true)
LOCAL_SHA=$(git rev-parse HEAD)
echo "remote main: $REMOTE_SHA"
echo "local  HEAD: $LOCAL_SHA"
if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  echo "MIRROR VERIFIED: https://github.com/$DST_OWNER/$DST_REPO"
else
  echo "ERROR: SHA mismatch between local and mirror"
  exit 1
fi
