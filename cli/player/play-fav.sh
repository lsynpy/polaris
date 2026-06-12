#!/bin/bash
# Load the fav playlist, shuffled, and start playing.
# Called by cover-hook.lua when the Play media key is pressed while idle.

cd /Users/kt/code/polaris/cli/player || exit 1
/usr/local/bin/node player.js playlist
/usr/local/bin/node player.js shuffle
