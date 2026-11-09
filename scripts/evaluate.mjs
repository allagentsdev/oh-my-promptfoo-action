import { spawnSync } from "node:child_process";

const env = process.env;
const mode = env.OMP_EXECUTION_MODE || "live";
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (mode !== "live" && mode !== "replay") fail("execution-mode must be live or replay");
if (mode === "live" && env.OMP_REPLAY_RESULTS)
  fail("replay-results requires execution-mode: replay");
let args;
if (mode === "replay") {
  if (!env.OMP_REPLAY_RESULTS) fail("replay-results is required in replay mode");
  let native;
  try {
    native = JSON.parse(env.OMP_ARGS ?? "[]");
  } catch {
    fail("args-json must be an empty array in replay mode");
  }
  if (!Array.isArray(native) || native.length || env.OMP_ARGS_FILE)
    fail(
      "Replay renders the complete recorded export; use an empty args-json array and no args-file",
    );
  args = ["report", "--replay", "--results", env.OMP_REPLAY_RESULTS];
} else {
  args = ["eval", "--args-json", env.OMP_ARGS ?? "[]", "--args-file", env.OMP_ARGS_FILE || ""];
}
args.push(
  "--config",
  env.OMP_CONFIG,
  "--working-directory",
  env.OMP_WORKING_DIRECTORY || ".",
  "--output-dir",
  env.OMP_OUTPUT_DIRECTORY || ".promptfoo-ci",
  "--suite-number",
  env.OMP_SUITE_NUMBER || "1",
  "--public-labels",
  env.OMP_PUBLIC_LABELS || "false",
  "--github",
);
const child = spawnSync(process.execPath, [env.OMP_CLI_PATH, ...args], { stdio: "inherit" });
if (child.error) console.error("The evaluation command could not start");
process.exitCode = child.status ?? 1;
