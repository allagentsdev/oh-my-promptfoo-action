import { execFileSync } from "node:child_process";
import { appendFile, lstat, mkdtemp, readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const action = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const started = performance.now();
const env = process.env;
const requestedMode = env.OMP_TOOLCHAIN_MODE || "";
const requestedDependencies = env.OMP_DEPENDENCY_DIRECTORY;
const workingDirectory = resolve(env.OMP_WORKING_DIRECTORY || ".");
if (!["", "source", "installed"].includes(requestedMode))
  throw new Error("toolchain-mode must be source or installed when specified");
if ((requestedMode === "installed") !== Boolean(requestedDependencies))
  throw new Error("dependency-directory is required only with toolchain-mode installed");

function within(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function discoverInstall(checkout) {
  const config = await realpath(resolve(workingDirectory, env.OMP_CONFIG));
  if (!within(checkout, config))
    throw new Error("Auto-discovery requires a config inside the checkout");
  for (let parent = dirname(config); within(checkout, parent); parent = dirname(parent)) {
    const candidate = join(parent, "node_modules", "oh-my-promptfoo");
    const exists = await lstat(candidate).then(
      () => true,
      (error) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
    if (exists) {
      const directory = await realpath(candidate);
      if (!within(checkout, directory))
        throw new Error("Discovered runtime must stay inside the checkout");
      return directory;
    }
    if (parent === checkout) break;
  }
}

const autoDiscover =
  !requestedMode &&
  env.GITHUB_EVENT_NAME === "workflow_dispatch" &&
  (env.OMP_EXECUTION_MODE || "live") === "live" &&
  env.OMP_CONFIG;
const checkout = autoDiscover ? await realpath(env.GITHUB_WORKSPACE) : undefined;
const discovered = checkout ? await discoverInstall(checkout) : undefined;
const mode = requestedMode || (discovered ? "installed" : "source");
const output = async (values) => {
  if (process.argv[2] !== "--setup") values["toolchain-duration-ms"] = performance.now() - started;
  for (const [key, value] of Object.entries(values)) {
    const delimiter = crypto.randomUUID();
    await appendFile(process.env.GITHUB_OUTPUT, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
  }
};
if (process.argv[2] === "--setup") {
  const fromWorkspace = (file) => relative(process.env.GITHUB_WORKSPACE, join(action, file));
  await output({
    manifest: fromWorkspace("package.json"),
    "node-version-file": fromWorkspace(".node-version"),
    "artifact-name": `promptfoo-results-${crypto.randomUUID()}`,
    "toolchain-mode": mode,
  });
  process.exit(0);
}
if (process.argv.length > 2) throw new Error("Unexpected toolchain setup argument");

// The reviewed source and its frozen lockfile pin the public CLI, Promptfoo and
// the package's complete build toolchain together.
const { repository, revision, installed } = JSON.parse(
  await readFile(new URL("../toolchain.json", import.meta.url), "utf8"),
);
if (mode === "installed") {
  const directory =
    discovered ??
    (await realpath(resolve(workingDirectory, requestedDependencies, "oh-my-promptfoo")));
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  if (manifest.name !== "oh-my-promptfoo" || manifest.version !== installed?.packageVersion)
    throw new Error("Installed oh-my-promptfoo version must match the reviewed toolchain pin");
  const peer = createRequire(join(directory, "package.json")).resolve("promptfoo");
  if (discovered && !within(checkout, await realpath(peer)))
    throw new Error("Discovered Promptfoo peer must stay inside the checkout");
  let parent = dirname(peer);
  while (true) {
    const metadata = await readFile(join(parent, "package.json"), "utf8")
      .then(JSON.parse)
      .catch(() => null);
    if (metadata?.name === "promptfoo") {
      if (metadata.version !== installed.promptfooVersion)
        throw new Error("Installed Promptfoo version must match the reviewed toolchain pin");
      break;
    }
    const next = dirname(parent);
    if (next === parent) throw new Error("Installed Promptfoo metadata is unavailable");
    parent = next;
  }
  const exportedFile = async (target) => {
    if (typeof target !== "string")
      throw new Error("The installed package is missing its public CLI or reporting export");
    const file = await realpath(resolve(directory, target));
    if (!file.startsWith(`${directory}${sep}`) || !(await stat(file)).isFile())
      throw new Error("The installed public export must be a file inside its package");
    return file;
  };
  await output({
    "toolchain-directory": directory,
    "cli-path": await exportedFile(manifest.bin?.["allagents-promptfoo"]),
    "reporting-path": await exportedFile(manifest.exports?.["./reporting"]?.import),
    "promptfoo-cli-path": resolve(
      parent,
      JSON.parse(await readFile(join(parent, "package.json"), "utf8")).bin.promptfoo,
    ),
  });
  console.log(
    `Using reviewed installed oh-my-promptfoo ${installed.packageVersion} and Promptfoo ${installed.promptfooVersion}.`,
  );
  process.exit(0);
}
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
execFileSync("pnpm", ["install", "--frozen-lockfile", "--ignore-scripts"], {
  cwd: directory,
  stdio: "inherit",
});
execFileSync("pnpm", ["build"], { cwd: directory, stdio: "inherit" });
const dist = join(directory, "packages/oh-my-promptfoo/dist");
const peerManifest = join(directory, "node_modules/promptfoo/package.json");
const peer = JSON.parse(await readFile(peerManifest, "utf8"));
await output({
  "toolchain-directory": directory,
  "cli-path": join(dist, "cli.js"),
  "reporting-path": join(dist, "reporting.js"),
  "promptfoo-cli-path": resolve(dirname(peerManifest), peer.bin.promptfoo),
});
console.log(`Prepared reviewed oh-my-promptfoo source ${revision}.`);
