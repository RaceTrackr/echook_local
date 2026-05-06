#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "eChook Live"
echo "-----------"

if [ ! -f "node_modules/.bin/concurrently" ]; then
    echo "Installing dependencies..."
    npm install
    echo
fi

echo "Starting servers. The network URL will appear below -- share it with other devices."
echo "Press Ctrl+C to stop."
echo

exec npm start
