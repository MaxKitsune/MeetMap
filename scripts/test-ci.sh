#!/usr/bin/env bash
set -euo pipefail

# One server and database for suites that share the API-created test owner.
export TEST_BASE_URL=http://localhost:3001
mkdir -p work/ci
setsid node scripts/test-server.mjs >work/ci/server.log 2>&1 &
server_pid=$!

cleanup() {
  result=$?
  trap - EXIT INT TERM
  # Stop the whole process group, including Next's worker and any migration.
  kill -TERM -- "-$server_pid" 2>/dev/null || true
  for attempt in {1..25}; do
    if ! kill -0 -- "-$server_pid" 2>/dev/null; then break; fi
    sleep 0.2
  done
  kill -KILL -- "-$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  if (( result != 0 )); then tail -n 200 work/ci/server.log; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# A healthy process alone is insufficient: readyz checks schema and upload access.
deadline=$((SECONDS + 180))
ready=false
while (( SECONDS < deadline )); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "::error::Test server exited before it became ready."
    exit 1
  fi
  response=$(curl --silent --fail --connect-timeout 1 --max-time 5 \
    http://localhost:3001/api/readyz 2>/dev/null) || response=""
  if [[ "$response" == '{"status":"ready"}' ]] && kill -0 "$server_pid" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "::error::Test server did not become ready within 180 seconds."
  exit 1
fi

result=0
run_suite() {
  local script=$1
  echo "::group::$script"
  if npm run "$script"; then
    outcome=passed
  else
    outcome=failed
    result=1
    echo "::error::$script failed."
  fi
  echo "::endgroup::"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    printf '| `%s` | %s |\n' "$script" "$outcome" >> "$GITHUB_STEP_SUMMARY"
  fi
}
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '| Suite | Result |\n| --- | --- |\n' >> "$GITHUB_STEP_SUMMARY"
fi
run_suite test:integration
run_suite test:integration:travel
run_suite test:e2e
exit "$result"
