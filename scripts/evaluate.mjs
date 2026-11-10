import { spawnSync } from "node:child_process";

const env = process.env;
const mode = env.OMP_EXECUTION_MODE || "live";
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!["live", "replay", "report"].includes(mode))
  fail("execution-mode must be live, replay or report");
if (mode !== "replay" && env.OMP_REPLAY_RESULTS)
  fail("replay-results requires execution-mode: replay");
if (mode !== "report" && (env.OMP_RESULTS || env.OMP_NATIVE_EXIT_CODE))
  fail("results and native-exit-code require execution-mode: report");
let args;
if (mode !== "live") {
  const path = mode === "replay" ? env.OMP_REPLAY_RESULTS : env.OMP_RESULTS;
  if (!path) fail("A native result path is required in report and replay modes");
  if (mode === "report" && !/^(unknown|0|[1-9]\d{0,2})$/.test(env.OMP_NATIVE_EXIT_CODE || ""))
    fail("Report mode requires native-exit-code: 0-255 or unknown");
  if (mode === "report" && Number(env.OMP_NATIVE_EXIT_CODE) > 255)
    fail("native-exit-code must be 0-255 or unknown");
  if (mode === "report" && env.OMP_TOOLCHAIN_MODE === "installed") {
    const help = spawnSync(process.execPath, [env.OMP_CLI_PATH, "--help"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    if (help.status !== 0 || !help.stdout.includes("--exit-code"))
      fail(
        "The installed reporter cannot preserve external exit codes. Use toolchain-mode: source for execution-mode: report.",
      );
  }
  let native;
  try {
    native = JSON.parse(env.OMP_ARGS ?? "[]");
  } catch {
    fail("args-json must be an empty array in report and replay modes");
  }
  if (!Array.isArray(native) || native.length || env.OMP_ARGS_FILE)
    fail("Reporting renders the complete export; use an empty args-json array and no args-file");
  args = ["report", "--results", path];
  if (mode === "replay") args.push("--replay");
  else args.push("--exit-code", env.OMP_NATIVE_EXIT_CODE);
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
