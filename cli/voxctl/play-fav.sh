#!/bin/bash
# Load the fav playlist, shuffled, and start playing.
# Called by cover-hook.lua when the Play media key is pressed while idle.

cd /Users/kt/code/vox/cli/voxctl || exit 1
/usr/local/bin/node voxctl.js playlist -s
