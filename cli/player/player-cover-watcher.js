#!/usr/bin/env node
// Persistent mpv cover art watcher for macOS NowPlaying.
// Connects to mpv IPC, listens for track changes, extracts embedded
// cover art via ffmpeg, and pushes it via cover-art-files property.
//
// Started automatically from player.sh when needed.
// Use: player-cover-watcher.js [--oneshot]

const net = require("net");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

const SOCKET_DIR = path.join(os.tmpdir(), "mpv-player");
const IPC_SOCKET = path.join(SOCKET_DIR, "mpv.sock");
const MUSIC_DIR = path.join(os.homedir(), "Music", "polaris");
const COVER_TMP = path.join(os.tmpdir(), "mpv-player-cover.jpg");
const COVER_CACHE = new Map();
const POLL_INTERVAL = 2000; // fallback poll (ms), used only if IPC event fails
const CACHE_MAX = 50;

let lastPath = "";

function sendMpvCommand(command) {
  return new Promise((resolve, reject) => {
    try {
      const client = new net.Socket();
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error("IPC timeout"));
      }, 5000);
      client.on("data", (data) => {
        clearTimeout(timeout);
        client.destroy();
        try {
          const lines = data.toString().trim().split("\n");
          const parsed = JSON.parse(lines[lines.length - 1]);
          if (parsed.error !== "success" && parsed.error) {
            reject(new Error(parsed.error));
          } else {
            resolve(parsed);
          }
        } catch { reject(new Error("parse error")); }
      });
      client.on("error", (err) => { clearTimeout(timeout); reject(err); });
      client.connect(IPC_SOCKET, () => {
        client.write(JSON.stringify({ command, request_id: Date.now() }) + "\n");
      });
    } catch (err) { reject(err); }
  });
}

function extractAndPushCover() {
  // Determine the current track's local path
  sendMpvCommand(["get_property", "path"]).then(async (resp) => {
    let localPath = resp?.data || "";
    if (!localPath) return;
    if (localPath === lastPath) return;
    lastPath = localPath;

    // Resolve JDC URL to local path
    if (localPath.startsWith("http://192.168.100.1:5050")) {
      try {
        const parts = new URL(localPath).pathname.split("/");
        const audioIdx = parts.indexOf("audio");
        if (audioIdx < 0) return;
        const relParts = parts.slice(audioIdx + 1).map(s => decodeURIComponent(s));
        if (relParts.length < 2) return;
        const relative = relParts.slice(1).join("/");
        const normRel = relative.startsWith("Music/") ? relative.slice(6) : relative;
        localPath = path.join(MUSIC_DIR, normRel);
      } catch { return; }
    } else if (!localPath.startsWith("/")) {
      localPath = path.join(MUSIC_DIR, localPath);
    }

    if (!fs.existsSync(localPath)) return;

    // Cache check
    let stat;
    try { stat = fs.statSync(localPath); } catch { return; }
    const cacheKey = `${localPath}:${stat.mtimeMs}`;
    if (COVER_CACHE.get(cacheKey)) return;

    // Extract cover via ffmpeg
    try {
      execSync(
        `ffmpeg -y -i '${localPath.replace(/'/g, "'\\''")}' -an -vcodec copy '${COVER_TMP}' 2>/dev/null`,
        { timeout: 5000, stdio: "ignore" }
      );
    } catch { return; }

    if (fs.existsSync(COVER_TMP) && fs.statSync(COVER_TMP).size > 100) {
      await sendMpvCommand(["set", "cover-art-files", COVER_TMP]);
      COVER_CACHE.set(cacheKey, true);
      if (COVER_CACHE.size > CACHE_MAX) {
        const firstKey = COVER_CACHE.keys().next().value;
        COVER_CACHE.delete(firstKey);
      }
    }
  }).catch(() => { /* mpv not running */ });
}

async function main() {
  const isOneshot = process.argv.includes("--oneshot");

  // If oneshot, just do one push and exit
  if (isOneshot) {
    await new Promise(r => setTimeout(r, 800));
    extractAndPushCover();
    setTimeout(() => process.exit(0), 3000);
    return;
  }

  // Watch mode: poll for track changes (simpler and more robust than
  // observing IPC properties, since net.Socket can't easily listen
  // for async events without a persistent connection protocol handler)
  console.log("🎵 Cover art watcher started (poll every 2s)");
  setInterval(extractAndPushCover, POLL_INTERVAL);

  // Also do an immediate push on start
  setTimeout(extractAndPushCover, 1000);

  // Handle graceful shutdown
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

main().catch(() => process.exit(1));
