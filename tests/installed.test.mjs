import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";

const root = resolve(import.meta.dirname, "..");
const execute = promisify(execFile);
const pin = JSON.parse(await readFile(join(root, "toolchain.json"), "utf8")).installed;
const action = parse(await readFile(join(root, "action.yml"), "utf8"));
function outputs(text) {
  const lines = text.trim().split("\n");
  const values = {};
  for (let i = 0; i < lines.length; i++) {
    const [name, delimiter] = lines[i].split("<<");
    const value = [];
    while (lines[++i] !== delimiter) value.push(lines[i]);
    values[name] = value.join("\n");
  }
  return values;
}

test("installed mode verifies real published packages, runs native evals and never fetches a fallback runtime", async () => {
  const directory = await mkdtemp(join(tmpdir(), "installed action "));
  try {
    const caller = join(directory, "caller with spaces");
    const temporary = join(directory, "runner temp");
    await mkdir(caller);
    await mkdir(temporary);
    await execute(
      "npm",
      [
        "install",
        "--prefix",
        caller,
        "--no-save",
        "--no-package-lock",
        "--ignore-scripts",
        "--include=optional",
        "--no-audit",
        "--no-fund",
        process.env.OMP_INSTALLED_TEST_TARBALL || `oh-my-promptfoo@${pin.packageVersion}`,
        `promptfoo@${pin.promptfooVersion}`,
      ],
      { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const attempts = join(directory, "setup-attempts");
    const guard = join(directory, "deny-setup.cjs");
    await writeFile(attempts, "");
    await writeFile(
      guard,
      `const fs = require('node:fs');
const deny = () => { fs.appendFileSync(process.env.SETUP_ATTEMPTS, 'attempt\\n'); throw new Error('Installed setup attempted process or network I/O'); };
const cp = require('node:child_process');
for (const name of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork']) cp[name] = deny;
require('node:net').Socket.prototype.connect = deny;
globalThis.fetch = deny;
require('node:module').syncBuiltinESMExports();\n`,
    );
    const preparedOutput = join(temporary, "runtime-outputs");
    const env = {
      ...process.env,
      OMP_TOOLCHAIN_MODE: "installed",
      OMP_DEPENDENCY_DIRECTORY: "node_modules",
      OMP_WORKING_DIRECTORY: caller,
      RUNNER_TEMP: temporary,
      GITHUB_WORKSPACE: caller,
      GITHUB_OUTPUT: preparedOutput,
      SETUP_ATTEMPTS: attempts,
    };
    const prepare = () =>
      execute(process.execPath, ["--require", guard, join(root, "scripts/prepare-toolchain.mjs")], {
        cwd: caller,
        env,
        timeout: 15_000,
      });
    await prepare();
    const runtime = outputs(await readFile(preparedOutput, "utf8"));
    assert.ok(Number.isFinite(Number(runtime["toolchain-duration-ms"])));
    assert.ok(Number(runtime["toolchain-duration-ms"]) > 0);
    assert.equal(await readFile(attempts, "utf8"), "");
    assert.ok(
      runtime["cli-path"].startsWith(await realpath(join(caller, "node_modules/oh-my-promptfoo"))),
    );
    const reporter = await import(pathToFileURL(runtime["reporting-path"]));
    assert.equal(typeof reporter.prepareResultArtifact, "function");
    const config = join(caller, "promptfooconfig.yaml");
    await writeFile(
      config,
      stringify({
        prompts: ["ANSWER_CANARY"],
        providers: ["echo"],
        tests: [
          {
            description: "An installed runtime case",
            metadata: { id: "installed-case-1" },
            assert: [{ type: "equals", value: "ANSWER_CANARY" }],
          },
        ],
      }),
    );
    const resultOutput = join(temporary, "eval-outputs");
    const summary = join(temporary, "summary.md");
    const step = action.runs.steps.find((item) => item.id === "evaluate");
    const evaluation = {
      ...process.env,
      OMP_ACTION_PATH: root,
      OMP_CLI_PATH: runtime["cli-path"],
      ALLAGENTS_EVAL_TOOLCHAIN_MS: runtime["toolchain-duration-ms"],
      OMP_CONFIG: config,
      OMP_EXECUTION_MODE: "live",
      OMP_REPLAY_RESULTS: "",
      OMP_ARGS: '["--no-cache"]',
      OMP_ARGS_FILE: "",
      OMP_WORKING_DIRECTORY: caller,
      OMP_OUTPUT_DIRECTORY: join(temporary, "results"),
      OMP_PUBLIC_LABELS: "true",
      GITHUB_OUTPUT: resultOutput,
      GITHUB_STEP_SUMMARY: summary,
    };
    const result = await execute("bash", ["-eo", "pipefail", "-c", step.run], {
      cwd: caller,
      timeout: 60_000,
      env: evaluation,
    });
    const resultPaths = outputs(await readFile(resultOutput, "utf8"));
    if (pin.packageVersion === "1.30.2" && !process.env.OMP_INSTALLED_TEST_TARBALL) {
      const unsupportedOutput = join(temporary, "unsupported-report-outputs");
      await assert.rejects(
        execute(process.execPath, [join(root, "scripts/evaluate.mjs")], {
          cwd: caller,
          timeout: 30_000,
          env: {
            ...evaluation,
            OMP_EXECUTION_MODE: "report",
            OMP_TOOLCHAIN_MODE: "installed",
            OMP_RESULTS: resultPaths["result-path"],
            OMP_NATIVE_EXIT_CODE: "0",
            OMP_ARGS: "[]",
            GITHUB_OUTPUT: unsupportedOutput,
          },
        }),
        (error) => error.stderr.includes("Use toolchain-mode: source"),
      );
      await assert.rejects(readFile(unsupportedOutput), { code: "ENOENT" });
    }
    assert.equal(resultPaths["evaluation-status"], "pass");
    const report = JSON.parse(await readFile(resultPaths["report-path"], "utf8"));
    assert.deepEqual(report.counts, { pass: 1, fail: 0, error: 0, unknown: 0 });
    assert.equal(report.cases[0].label, "installed-case-1");
    assert.ok(!result.stdout.includes("ANSWER_CANARY"));
    assert.ok(!(await readFile(summary, "utf8")).includes("ANSWER_CANARY"));
    await writeFile(config, "{not-valid: [");
    const replayOutput = join(temporary, "replay-outputs");
    const replay = await execute("bash", ["-eo", "pipefail", "-c", step.run], {
      cwd: caller,
      timeout: 60_000,
      env: {
        ...evaluation,
        OMP_EXECUTION_MODE: "replay",
        OMP_REPLAY_RESULTS: resultPaths["result-path"],
        OMP_ARGS: "[]",
        GITHUB_OUTPUT: replayOutput,
        GITHUB_STEP_SUMMARY: join(temporary, "replay-summary.md"),
      },
    });
    const replayPaths = outputs(await readFile(replayOutput, "utf8"));
    assert.equal(replayPaths["evaluation-status"], "pass");
    assert.equal(replayPaths.replayed, "true");
    assert.deepEqual(
      JSON.parse(await readFile(replayPaths["report-path"], "utf8")).cases,
      report.cases,
    );
    assert.ok(!replay.stdout.includes("Completed 1"));
    const metadataPath = join(caller, "node_modules/oh-my-promptfoo/package.json");
    const metadata = await readFile(metadataPath, "utf8");
    await writeFile(metadataPath, JSON.stringify({ ...JSON.parse(metadata), version: "0.0.0" }));
    await assert.rejects(prepare(), /Installed oh-my-promptfoo version must match/);
    await writeFile(metadataPath, metadata);
    const peerPath = join(caller, "node_modules/promptfoo/package.json");
    const peer = await readFile(peerPath, "utf8");
    await writeFile(peerPath, JSON.stringify({ ...JSON.parse(peer), version: "0.0.0" }));
    await assert.rejects(prepare(), /Installed Promptfoo version must match/);
    await writeFile(peerPath, peer);
    await rm(join(caller, "node_modules/oh-my-promptfoo"), { recursive: true });
    await assert.rejects(prepare(), /ENOENT/);
    assert.equal(
      await readFile(attempts, "utf8"),
      "",
      "Missing/mismatched installs must never fall back to source setup",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runtime input ownership rejects invalid modes and ambiguous dependency directories before setup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "runtime-inputs-"));
  try {
    for (const [mode, dependencies] of [
      ["unknown", ""],
      ["source", "node_modules"],
      ["installed", ""],
    ]) {
      const file = join(directory, "outputs");
      await writeFile(file, "");
      await assert.rejects(
        execute(process.execPath, [join(root, "scripts/prepare-toolchain.mjs"), "--setup"], {
          env: {
            ...process.env,
            OMP_TOOLCHAIN_MODE: mode,
            OMP_DEPENDENCY_DIRECTORY: dependencies,
            GITHUB_WORKSPACE: directory,
            GITHUB_OUTPUT: file,
          },
        }),
        /toolchain-mode|dependency-directory/,
      );
      assert.equal(await readFile(file, "utf8"), "");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
