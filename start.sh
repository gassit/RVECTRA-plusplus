#!/bin/bash
cd "$(dirname "$0")"
export NODE_OPTIONS="--max-old-space-size=4096"
exec node node_modules/.bin/next dev --webpack
