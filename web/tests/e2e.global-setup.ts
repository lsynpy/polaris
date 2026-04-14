import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { FullConfig } from "@playwright/test";

const E2E_PORT = 5051;

async function waitForServer(port: number, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        http
          .get(`http://localhost:${port}/api/version`, (res) => {
            res.resume();
            res.on("end", resolve);
            res.on("error", reject);
          })
          .on("error", reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server did not start on port ${port} within ${timeoutMs}ms`);
}

export default async function globalSetup(_config: FullConfig) {
  const projectRoot = path.resolve(__dirname, "../..");
  const tmpDir = path.join(
    projectRoot,
    ".tmp",
    `.polaris-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  // Create isolated data directory
  fs.mkdirSync(tmpDir, { recursive: true });

  // Create empty config file so server starts with no users (triggers setup wizard)
  fs.writeFileSync(path.join(tmpDir, "polaris.toml"), "");

  // Start Polaris server on port 5051 with its own isolated data and config
  const serverDir = path.join(projectRoot, "server");
  const server = spawn(
    "cargo",
    [
      "run",
      "--",
      "-f",
      "--port",
      String(E2E_PORT),
      "--data",
      tmpDir,
      "--config",
      path.join(tmpDir, "polaris.toml"),
      "-w",
      "../web/dist"
    ],
    {
      cwd: serverDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env }
    }
  );

  // Write PID inside the temp dir so teardown can find it
  fs.writeFileSync(path.join(tmpDir, "pid"), String(server.pid));

  await waitForServer(E2E_PORT);
}
