#!/usr/bin/env bash
set -Eeuo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
work=$(mktemp -d); trap 'rm -rf -- "$work"' EXIT
export MEMORY_MEMINFO_FILE=$work/meminfo ALERT_MEMORY_STATE_DIR=$work/state ALERT_LOG=$work/alerts.log ALERT_EMAIL_ENABLED=false
sample() { printf 'MemTotal: 100000 kB\nMemAvailable: %s kB\n' "$2" > "$MEMORY_MEMINFO_FILE"; MEMORY_TEST_NOW=$1 bash "$here/../monitor/check-memory.sh"; }
sample 1000 14000
sample 1120 14000
sample 1240 14000
sample 1360 14000
sample 1480 14000
code=0; sample 1600 14000 || code=$?
[[ $code == 2 && $(grep -c 'RAM sostenida' "$ALERT_LOG") == 1 ]]
sample 1660 14000 || [[ $? == 2 ]]
[[ $(grep -c 'RAM sostenida' "$ALERT_LOG") == 1 ]]
sample 1700 25000
sample 1760 14000
[[ $(cut -d' ' -f1 "$work/state/memory.state") == 1760 ]]
# A gap in observations resets the duration; it does not prove sustained pressure.
sample 2400 14000
[[ $(cut -d' ' -f1 "$work/state/memory.state") == 2400 ]]
echo 'PASS: RAM >85% sustained 10 minutes, one alert, recovery and missed-sample reset'
