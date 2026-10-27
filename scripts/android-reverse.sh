#!/usr/bin/env bash
# Forwards the local euron-open-ai-chat stack's ports into a connected Android emulator or
# USB device, so the app's localhost URLs (API, website, S3 emulator, stubs, Metro) work
# there exactly as on the iOS simulator. Run it again after an emulator restarts.
#
#   pnpm android:reverse            (every connected device)
set -euo pipefail
PORTS=(5036 3540 4607 5129 8056 8098)
devices="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
if [[ -z "$devices" ]]; then
  echo "No Android device or emulator connected (adb devices)." >&2
  exit 1
fi
for d in $devices; do
  for p in "${PORTS[@]}"; do adb -s "$d" reverse "tcp:$p" "tcp:$p" >/dev/null; done
  echo "$d: forwarded ${PORTS[*]}"
done
