#!/usr/bin/env node
// Persistent mpv cover art watcher for macOS NowPlaying.
// Opens a persistent IPC connection to mpv, observes the "path"
// property, and pushes embedded cover art via cover-art-files when
// the track changes. Reacts to mpv events (not polling), so the
// cover is always set at the right time — after the new file loads.
//
// Started automatically from ensureMpv() in player.js.

const net = require("net");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

const SOCKET_DIR = path.join(os.homedir(), ".polaris", "player");
const IPC_SOCKET = path.join(SOCKET_DIR, "mpv.sock");
const MUSIC_DIR = path.join(os.homedir(), "Music", "polaris");
const COVER_CACHE = new Map();
const CACHE_MAX = 50;

// Pending state: if a path change was detected but cover hasn't been
// pushed yet (waiting for the file to actually load).
let pendingPath = null;
let pendingTimer = null;

function coverTmpPath(localPath) {
  const base = path.basename(localPath).replace(/[^a-zA-Z0-9_\-]/g, "_");
  return path.join(os.tmpdir(), `mpv-cover-${base}-${Date.now()}.jpg`);
}

// ─── IPC: send a command over the persistent connection ─────────

let reqId = 100;
const pendingCommands = new Map();
let sock = null;
let recvBuf = "";

function sendCommand(command) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    const msg = JSON.stringify({ command, request_id: id }) + "\n";
    pendingCommands.set(id, { resolve, reject });
    try { sock.write(msg); } catch (e) { pendingCommands.delete(id); reject(e); }
    setTimeout(() => {
      const p = pendingCommands.get(id);
      if (p) { pendingCommands.delete(id); p.reject(new Error("timeout")); }
    }, 8000);
  });
}

function onIpcData(data) {
  recvBuf += data.toString();
  const lines = recvBuf.split("\n");
  recvBuf = lines.pop(); // keep incomplete line
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      // Command response
      if (msg.request_id && pendingCommands.has(msg.request_id)) {
        const p = pendingCommands.get(msg.request_id);
        pendingCommands.delete(msg.request_id);
        if (msg.error !== "success" && msg.error) {
          p.reject(new Error(msg.error));
        } else {
          p.resolve(msg);
        }
        continue;
      }
      // Event
      if (msg.event === "property-change" && msg.name === "path") {
        onPathChanged(msg.data);
      }
    } catch { /* skip malformed lines */ }
  }
}

// ─── Cover extraction and push ─────────────────────────────────

function extractAndPushCover(localPath) {
  if (!fs.existsSync(localPath)) return;

  let stat;
  try { stat = fs.statSync(localPath); } catch { return; }
  const cacheKey = `${localPath}:${stat.mtimeMs}`;
  if (COVER_CACHE.get(cacheKey)) return;

  const coverPath = coverTmpPath(localPath);
  try {
    execSync(
      `ffmpeg -y -i '${localPath.replace(/'/g, "'\\''")}' -an -vcodec copy '${coverPath}' 2>/dev/null`,
      { timeout: 8000, stdio: "ignore" }
    );
  } catch { return; }

  if (fs.existsSync(coverPath) && fs.statSync(coverPath).size > 100) {
    sendCommand(["set", "cover-art-files", coverPath]).catch(() => {});
    COVER_CACHE.set(cacheKey, true);
    if (COVER_CACHE.size > CACHE_MAX) {
      const firstKey = COVER_CACHE.keys().next().value;
      COVER_CACHE.delete(firstKey);
    }
    cleanupOldCovers(coverPath);
  }
}

function cleanupOldCovers() {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith("mpv-cover-") && f.endsWith(".jpg"))
      .map(f => ({ path: path.join(tmpDir, f), mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (let i = 10; i < files.length; i++) {
      try { fs.unlinkSync(files[i].path); } catch {}
    }
  } catch {}
}

// ─── Path change handler ────────────────────────────────────────

function onPathChanged(rawUrl) {
  if (!rawUrl) return;
  if (rawUrl === pendingPath) return; // already queued
  pendingPath = rawUrl;

  // Cancel any pending cover push and schedule a new one.
  // We wait 1.5s after path change — plenty of time for mpv to
  // finish loading the new file and start playback.
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    resolvePathAndPush(rawUrl);
  }, 1500);
}

function resolvePathAndPush(rawUrl) {
  let localPath = rawUrl || "";
  if (!localPath) return;

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

  extractAndPushCover(localPath);
}

// ─── Connection management ──────────────────────────────────────

let reconnectTimer = null;

function connect() {
  if (sock) {
    try { sock.destroy(); } catch {}
    sock = null;
  }

  sock = new net.Socket();
  recvBuf = "";

  sock.on("data", onIpcData);
  sock.on("error", () => scheduleReconnect());
  sock.on("close", () => scheduleReconnect());

  sock.connect(IPC_SOCKET, () => {
    // Subscribe to path changes
    sendCommand(["observe_property", 1, "path"]).catch(() => {});
    // Also do an immediate cover push for the current track
    sendCommand(["get_property", "path"]).then(r => {
      if (r?.data) onPathChanged(r.data);
    }).catch(() => {});
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
  console.log("🎵 Cover art watcher started (event-driven)");
  connect();

  process.on("SIGINT", () => { if (sock) sock.destroy(); process.exit(0); });
  process.on("SIGTERM", () => { if (sock) sock.destroy(); process.exit(0); });
}

main();
