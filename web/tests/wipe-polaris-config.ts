import fs from "node:fs";
import type { FullConfig } from "@playwright/test";

async function globalSetup(_config: FullConfig) {
  await fs.writeFile("automated.config.toml", "", () => {});
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Give server time to detect and apply config change
}

export default globalSetup;
