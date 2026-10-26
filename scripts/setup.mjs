import "./check-environment.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this installer with npm run setup.");

// Run npm through Node instead of shell-specific npm.cmd/npm executables.
for (const directory of ["../", "../client/", "../server/"]) {
  const cwd = fileURLToPath(new URL(directory, import.meta.url));
  console.log(`Installing locked dependencies in ${cwd}`);
  const result = spawnSync(process.execPath, [npmCli, "ci"], { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Setup complete. Run npm run dev, or npm run build followed by npm start.");
