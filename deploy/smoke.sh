#!/usr/bin/env sh
set -eu

check_page() {
  url="$1"
  marker="$2"
  body="$(curl --noproxy '*' -fsS --max-time 15 "$url")"
  printf '%s' "$body" | grep -Fq "$marker"
  printf 'PASS %s contains %s\n' "$url" "$marker"
}

check_page 'https://lninl.com/' 'Personal AI Agent'
check_page 'https://lninl.com/zh/' '个人 AI Agent'
check_page 'https://lninl.com/guide/personal-ai-agent/' 'What is a Personal AI Agent?'
check_page 'https://lninl.com/zh/guide/personal-ai-agent/' '什么是 Personal AI Agent？'
check_page 'https://lninl.com/api/health' '"status":"ok"'
curl --noproxy '*' -fsSI --max-time 15 'https://www.lninl.com/' | grep -q '^HTTP/.* 200'
printf 'PASS https://www.lninl.com/ returns 200\n'
