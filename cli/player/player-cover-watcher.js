#!/usr/bin/env node
// Persistent mpv cover art watcher for macOS NowPlaying.
// Opens a persistent IPC connection to mpv, observes the "path"
// property, and pushes cover art via cover-art-files when the track
// changes. Reacts to mpv events (not polling).
//
// All temp files and logs go to /tmp/polaris-player/
//
// Started automatically from ensureMpv() in player.js.

const net = require("net");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");
const { PLAYER_DIR, info, warn, error } = require("./player-logger");

const SOCKET_DIR = path.join(os.homedir(), ".polaris", "player");
const IPC_SOCKET = path.join(SOCKET_DIR, "mpv.sock");
const COVER_CACHE = new Map();
const CACHE_MAX = 50;

let pendingPath = null;
let pendingTimer = null;

function coverTmpPath(localPath) {
  const base = path.basename(localPath, path.extname(localPath));
  const safe = base.replace(/[/\\:*?"<>|]/g, "_").slice(0, 60);
  const hash = require("crypto").createHash("md5").update(localPath).digest("hex").slice(0, 8);
  return path.join(PLAYER_DIR, `cover-${safe}-${hash}.jpg`);
}

// ─── IPC ────────────────────────────────────────────────────

let reqId = 100;
const pendingCommands = new Map();
let sock = null;
let recvBuf = "";

function sendCommand(command) {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    const msg = JSON.stringify({ command, request_id: id }) + "\n";
    pendingCommands.set(id, { resolve, reject });
    try {
      sock.write(msg);
    } catch (e) {
      pendingCommands.delete(id);
      reject(e);
    }
    setTimeout(() => {
      const p = pendingCommands.get(id);
      if (p) {
        pendingCommands.delete(id);
        p.reject(new Error("timeout"));
      }
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
        if (msg.error !== "success" && msg.error) {
          p.reject(new Error(msg.error));
        } else {
          p.resolve(msg);
        }
        continue;
      }
      if (msg.event === "property-change" && msg.name === "path") {
        onPathChanged(msg.data);
      }
    } catch {
      /* skip malformed lines */
    }
  }
}

// ─── Cover download from Polaris API ────────────────────────

function downloadAndPushCover(polarisPath) {
  if (!polarisPath) {
    warn("downloadAndPushCover called with empty path");
    return;
  }

  const cacheKey = `polaris:${polarisPath}`;
  if (COVER_CACHE.get(cacheKey)) {
    info("Cover cache hit, skipping", { polarisPath });
    return;
  }

  info("Cover download initiated from Polaris API", { polarisPath });
  const coverPath = coverTmpPath(polarisPath);

  getPolarisToken()
    .then((token) => {
      const http = require("http");
      const urlStr = `http://192.168.100.1:5050/api/thumbnail/${encodeURIComponent(polarisPath)}?size=small&pad=false&auth_token=${encodeURIComponent(token)}`;
      const u = new URL(urlStr);
      return new Promise((resolve, reject) => {
        const req = http.request(
          { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: "GET", headers: { "Accept-Version": "8" } },
          (res) => {
            const c = [];
            res.on("data", (x) => c.push(x));
            res.on("end", () => resolve(Buffer.concat(c)));
          }
        );
        req.on("error", reject);
        req.end();
      });
    })
    .then((data) => {
      if (!data || data.length <= 100) {
        warn("Cover download too small or empty", { bytes: data?.length || 0 });
        return;
      }
      info("Cover downloaded from Polaris API", { bytes: data.length });
      fs.writeFileSync(coverPath, data);
      info("Cover written to disk", { path: coverPath, bytes: data.length });
      return sendCommand(["set", "cover-art-files", coverPath]);
    })
    .then(() => {
      info("cover-art-files set via IPC", { coverPath });
      COVER_CACHE.set(cacheKey, true);
      if (COVER_CACHE.size > CACHE_MAX) {
        const firstKey = COVER_CACHE.keys().next().value;
        COVER_CACHE.delete(firstKey);
      }
      cleanupOldCovers();
    })
    .catch((err) => {
      error("Cover download/push failed", { error: err.message, polarisPath });
    });
}

function getPolarisToken() {
  return new Promise((resolve, reject) => {
    const http = require("http");
    const req = http.request(
      { hostname: "192.168.100.1", port: 5050, path: "/api/auth", method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d).token); } catch { reject(new Error("auth failed")); }
        });
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify({ username: "admin", password: "admin" }));
    req.end();
  });
}

function extractPolarisPath(jdcUrl) {
  if (jdcUrl.startsWith("http://192.168.100.1:5050")) {
    try {
      const u = new URL(jdcUrl);
      const segments = u.pathname.split("/").filter(Boolean);
      const audioIdx = segments.indexOf("audio");
      if (audioIdx >= 0) {
        const result = segments.slice(audioIdx + 1).map((s) => decodeURIComponent(s)).join("/");
        info("Extracted Polaris path from JDC URL", { jdcUrl, polarisPath: result });
        return result;
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

function onPathChanged(rawUrl) {
  if (!rawUrl) return;
  if (rawUrl === pendingPath) return;
  pendingPath = rawUrl;
  info("mpv path changed", { path: rawUrl });

  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    resolvePathAndPush(rawUrl);
  }, 1500);
}

function resolvePathAndPush(rawUrl) {
  info("Resolving path for cover push", { rawUrl });
  const polarisPath = extractPolarisPath(rawUrl);
  if (polarisPath) {
    downloadAndPushCover(polarisPath);
  } else {
    warn("Could not extract Polaris path, skipping cover", { rawUrl });
  }
}

// ─── Connection management ──────────────────────────────────

let reconnectTimer = null;

function connect() {
  if (sock) {
    try { sock.destroy(); } catch {}
    sock = null;
  }

  sock = new net.Socket();
  recvBuf = "";

  sock.on("data", onIpcData);
  sock.on("error", (err) => {
    error("IPC socket error", { error: err.message });
    scheduleReconnect();
  });
  sock.on("close", () => {
    warn("IPC connection closed, reconnecting...");
    scheduleReconnect();
  });

  sock.connect(IPC_SOCKET, () => {
    info("Connected to mpv IPC", { socket: IPC_SOCKET });
    sendCommand(["observe_property", 1, "path"]).catch(() => {});
    sendCommand(["get_property", "path"])
      .then((r) => {
        if (r?.data) onPathChanged(r.data);
      })
      .catch(() => {});
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 3000);
}

// ─── Main ───────────────────────────────────────────────────

function main() {
  info("Cover art watcher starting (event-driven)");
  connect();

  process.on("SIGINT", () => {
    info("Received SIGINT, shutting down");
    if (sock) sock.destroy();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    info("Received SIGTERM, shutting down");
    if (sock) sock.destroy();
    process.exit(0);
  });
}

main();
