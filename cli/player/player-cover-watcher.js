#!/usr/bin/env node
// Persistent mpv cover art watcher for macOS NowPlaying.
// Opens a persistent IPC connection to mpv, observes the "path"
// property, and pushes cover art via cover-art-files when the track
// changes.
//
// SYNC flow:
//   1. path changes (new track incoming)
//   2. download new track's cover (sync, blocks)
//   3. set cover-art-files (sync, writes to socket)
//   4. return — mpv finishes loading the file, reads cover-art-files
//      → correct cover
//
// All temp files and logs go to /tmp/polaris-player/

const net = require("net");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
const crypto = require("crypto");
const { PLAYER_DIR, info, warn, error } = require("./player-logger");

const SOCKET_DIR = path.join(os.homedir(), ".polaris", "player");
const IPC_SOCKET = path.join(SOCKET_DIR, "mpv.sock");
const COVER_CACHE = new Map();
const CACHE_MAX = 50;

let pendingPath = null;
let sock = null;
let recvBuf = "";
let reqId = 100;
const pendingCommands = new Map();

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
  recvBuf = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.request_id && pendingCommands.has(msg.request_id)) {
        const p = pendingCommands.get(msg.request_id);
        pendingCommands.delete(msg.request_id);
        if (msg.error !== "success" && msg.error) { p.reject(new Error(msg.error)); }
        else { p.resolve(msg); }
        continue;
      }
      if (msg.event === "property-change" && msg.name === "path") {
        onPathChanged(msg.data);
      }
      if (msg.event === "file-loaded") {
        onFileLoaded();
      }
    } catch { /* skip malformed lines */ }
  }
}

function coverTmpPath(localPath) {
  const base = path.basename(localPath, path.extname(localPath));
  const safe = base.replace(/[/\\:*?"<>|]/g, "_").slice(0, 60);
  const hash = crypto.createHash("md5").update(localPath).digest("hex").slice(0, 8);
  return path.join(PLAYER_DIR, `cover-${safe}-${hash}.jpg`);
}

// ─── Synchronous cover download via curl ───────────────────

function downloadCoverSync(polarisPath) {
  const cacheKey = `polaris:${polarisPath}`;
  const coverPath = coverTmpPath(polarisPath);

  if (COVER_CACHE.get(cacheKey)) {
    info("Cover cache hit, setting cover-art-files", { polarisPath });
    // sync write to IPC socket, don't wait for response
    sock.write(JSON.stringify({ command: ["set", "cover-art-files", coverPath] }) + "\n");
    info("cover-art-files set via IPC (cached)", { coverPath });
    return;
  }

  info("Cover download initiated", { polarisPath });

  try {
    // Step 1: auth
    const authOut = execSync(
      `curl -s -X POST -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' http://192.168.100.1:5050/api/auth`,
      { encoding: "utf-8", timeout: 5000 }
    );
    const token = JSON.parse(authOut).token;

    // Step 2: download thumbnail
    const url = `http://192.168.100.1:5050/api/thumbnail/${encodeURIComponent(polarisPath)}?size=small&pad=false&auth_token=${encodeURIComponent(token)}`;
    // shell-safe quoting: handle URLs with single quotes (e.g. "Guns N' Roses")
    const shellUrl = "'" + url.replace(/'/g, "'\\''") + "'";
    const data = execSync(`curl -s -H 'Accept-Version: 8' ${shellUrl}`, { encoding: "buffer", timeout: 5000 });

    // Step 3: check data
    if (!data || data.length <= 100) {
      warn("Cover download too small or empty, clearing cover", { bytes: data?.length || 0 });
      sock.write(JSON.stringify({ command: ["set", "cover-art-files", ""] }) + "\n");
      info("cover-art-files cleared (no cover available)", { polarisPath });
      return;
    }

    // Step 4: save to disk
    info("Cover downloaded", { bytes: data.length });
    fs.writeFileSync(coverPath, data);
    info("Cover written to disk", { path: coverPath });

    // Step 5: cache
    COVER_CACHE.set(cacheKey, true);
    if (COVER_CACHE.size > CACHE_MAX) {
      const firstKey = COVER_CACHE.keys().next().value;
      COVER_CACHE.delete(firstKey);
    }
    cleanupOldCovers();

    // Step 6: set cover-art-files via IPC (sync write, don't wait)
    info("Setting cover-art-files via IPC", { coverPath });
    sock.write(JSON.stringify({ command: ["set", "cover-art-files", coverPath] }) + "\n");
    info("cover-art-files set via IPC", { coverPath });
  } catch (err) {
    error("Cover operation failed, clearing cover", { error: err.message, polarisPath });
    sock.write(JSON.stringify({ command: ["set", "cover-art-files", ""] }) + "\n");
    info("cover-art-files cleared (cover download failed)", { polarisPath });
  }
}

function extractPolarisPath(jdcUrl) {
  if (jdcUrl.startsWith("http://192.168.100.1:5050")) {
    try {
      const u = new URL(jdcUrl);
      const segments = u.pathname.split("/").filter(Boolean);
      const audioIdx = segments.indexOf("audio");
      if (audioIdx >= 0) {
        return segments.slice(audioIdx + 1).map((s) => decodeURIComponent(s)).join("/");
      }
    } catch {
      error("Failed to parse JDC URL", { jdcUrl });
      return null;
    }
  } else if (jdcUrl.startsWith("/")) {
    return jdcUrl;
  } else if (jdcUrl) {
    return `Music/${jdcUrl}`;
  }
  return null;
}

function cleanupOldCovers() {
  try {
    const files = fs.readdirSync(PLAYER_DIR)
      .filter((f) => f.startsWith("cover-") && f.endsWith(".jpg"))
      .map((f) => ({ path: path.join(PLAYER_DIR, f), mtime: fs.statSync(path.join(PLAYER_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    let removed = 0;
    for (let i = 10; i < files.length; i++) {
      try { fs.unlinkSync(files[i].path); removed++; } catch {}
    }
    if (removed > 0) info("Cleaned up old cover files", { removed });
  } catch {}
}

// ─── Path change handler ────────────────────────────────────

function onFileLoaded() {
  info("music playing");
}

function onPathChanged(rawUrl) {
  if (!rawUrl) return;
  if (rawUrl === pendingPath) return;
  pendingPath = rawUrl;
  info("────────────────────────────────────────");
  info("mpv path changed — downloading cover for new track", { path: rawUrl });

  const polarisPath = extractPolarisPath(rawUrl);
  if (polarisPath) {
    // SYNC: download cover, set cover-art-files, THEN let mpv continue loading
    downloadCoverSync(polarisPath);
  } else {
    warn("Could not extract Polaris path, skipping cover", { rawUrl });
  }
}

// ─── Connection management ──────────────────────────────────

let reconnectTimer = null;

function connect() {
  if (sock) { try { sock.destroy(); } catch {} sock = null; }

  sock = new net.Socket();
  recvBuf = "";

  sock.on("data", onIpcData);
  sock.on("error", (err) => { error("IPC socket error", { error: err.message }); scheduleReconnect(); });
  sock.on("close", () => { warn("IPC connection closed, reconnecting..."); scheduleReconnect(); });

  sock.connect(IPC_SOCKET, () => {
    info("Connected to mpv IPC", { socket: IPC_SOCKET });
    // observe_property immediately sends the current path as the first
    // property-change notification, so we don't need a separate get_property.
    // onPathChanged will handle BOTH the initial push AND future track changes.
    sendCommand(["observe_property", 1, "path"]).catch(() => {});
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 3000);
}

// ─── Main ───────────────────────────────────────────────────

function main() {
  info("Cover art watcher starting (event-driven)");
  connect();

  process.on("SIGINT", () => { info("Received SIGINT, shutting down"); if (sock) sock.destroy(); process.exit(0); });
  process.on("SIGTERM", () => { info("Received SIGTERM, shutting down"); if (sock) sock.destroy(); process.exit(0); });
}

main();
