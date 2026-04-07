#!/bin/bash
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=4096"
exec node node_modules/.bin/next dev
