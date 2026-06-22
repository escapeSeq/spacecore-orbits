#!/bin/sh
set -e

if [ -d /docker-entrypoint.d ]; then
  echo "/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration"
  find /docker-entrypoint.d/ -type f -name '*.sh' | sort | while read -r f; do
    if [ -x "$f" ]; then
      echo "/docker-entrypoint.sh: Launching $f"
      "$f"
    else
      echo "/docker-entrypoint.sh: Sourcing $f"
      # shellcheck disable=SC1090
      . "$f"
    fi
  done
fi

echo "/docker-entrypoint.sh: Configuration complete; ready for start up"

nginx -g 'daemon off;' &
nginx_pid=$!

ready=0
i=0
while [ "$i" -lt 50 ]; do
  if wget -q --spider http://127.0.0.1/health 2>/dev/null; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 0.2
done

if [ "$ready" -eq 1 ]; then
  echo ""
  echo "=========================================="
  echo "  SpaceCore Simulation is running"
  echo "  Open: http://localhost:3002"
  echo "  Health: http://localhost:3002/health"
  echo "=========================================="
  echo ""
else
  echo "WARNING: nginx started but health check did not respond in time" >&2
fi

wait "$nginx_pid"
