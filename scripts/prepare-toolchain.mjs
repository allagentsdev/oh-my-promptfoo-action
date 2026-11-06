import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";

// This source pin contains the public eval/report CLI before its first npm release.
// Its own frozen lockfile pins Promptfoo and the package's complete build toolchain.
const { repository, revision } = JSON.parse(
  await readFile(new URL("../toolchain.json", import.meta.url), "utf8"),
);
const directory = await mkdtemp(join(process.env.RUNNER_TEMP, "oh-my-promptfoo-"));
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
};
const git = (args) => execFileSync("git", args, { cwd: directory, env: gitEnv, stdio: "inherit" });
git(["init", "--quiet"]);
git(["fetch", "--quiet", "--depth=1", repository, revision]);
git(["checkout", "--quiet", "--detach", revision]);
execFileSync(
  "pnpm",
  ["install", "--frozen-lockfile", "--ignore-scripts", "--registry=https://registry.npmjs.org"],
  { cwd: directory, stdio: "inherit" },
);
execFileSync("pnpm", ["build"], { cwd: directory, stdio: "inherit" });
const dist = join(directory, "packages/oh-my-promptfoo/dist");
const outputs = {
  "toolchain-directory": directory,
  "cli-path": join(dist, "cli.js"),
  "reporting-path": join(dist, "reporting.js"),
};
for (const [key, value] of Object.entries(outputs)) {
  const delimiter = crypto.randomUUID();
  await appendFile(process.env.GITHUB_OUTPUT, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
}
console.log(`Prepared reviewed oh-my-promptfoo source ${revision}.`);
