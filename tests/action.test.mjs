import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { parse, stringify } from "yaml";

const root = resolve(import.meta.dirname, "..");
const action = parse(await readFile(join(root, "action.yml"), "utf8"));
const runtime = process.env.OMP_TOOLCHAIN_DIRECTORY;
assert.ok(
  runtime,
  "Prepare the real pinned toolchain and set OMP_TOOLCHAIN_DIRECTORY before testing",
);
const cli = join(runtime, "packages/oh-my-promptfoo/dist/cli.js");
const reporting = join(runtime, "packages/oh-my-promptfoo/dist/reporting.js");
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
function outputs(text) {
  const values = {};
  const lines = text.trim().split("\n");
  for (let i = 0; i < lines.length; i++) {
    const [key, delimiter] = lines[i].split("<<");
    if (delimiter) {
      const content = [];
      while (lines[++i] !== delimiter) content.push(lines[i]);
      values[key] = content.join("\n");
    } else {
      const split = lines[i].indexOf("=");
      values[lines[i].slice(0, split)] = lines[i].slice(split + 1);
    }
  }
  return values;
}
function shell(step, cwd, env) {
  return spawnSync("bash", ["-eo", "pipefail", "-c", step.run], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 90_000,
  });
}
async function evaluate(directory, config, args, extra = {}) {
  const output = join(directory, crypto.randomUUID());
  const summary = `${output}.md`;
  const step = action.runs.steps.find((item) => item.id === "evaluate");
  const child = shell(step, directory, {
    OMP_CLI_PATH: cli,
    OMP_CONFIG: config,
    OMP_ARGS: JSON.stringify(args),
    OMP_ARGS_FILE: "",
    OMP_WORKING_DIRECTORY: directory,
    OMP_OUTPUT_DIRECTORY: "private outputs",
    OMP_SUITE_NUMBER: "1",
    OMP_PUBLIC_LABELS: "true",
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
    PROMPTFOO_DISABLE_TELEMETRY: "1",
    PROMPTFOO_DISABLE_UPDATE: "1",
    ...extra,
  });
  assert.ok(existsSync(output), "The Action must expose outputs even on evaluation failure");
  return {
    ...child,
    values: outputs(await readFile(output, "utf8")),
    summary: await readFile(summary, "utf8"),
  };
}

test("the source pin and setup paths resolve independently of the caller checkout", async () => {
  const pin = await json(join(root, "toolchain.json"));
  assert.equal(
    execFileSync("git", ["rev-parse", "HEAD"], { cwd: runtime, encoding: "utf8" }).trim(),
    pin.revision,
  );
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP, "action caller "));
  try {
    const output = join(directory, "setup");
    const child = shell(
      action.runs.steps.find((s) => s.id === "toolchain"),
      directory,
      {
        OMP_ACTION_PATH: root,
        GITHUB_WORKSPACE: directory,
        GITHUB_OUTPUT: output,
      },
    );
    assert.equal(child.status, 0, child.stderr);
    const values = outputs(await readFile(output, "utf8"));
    assert.equal((await json(resolve(directory, values.manifest))).packageManager, "pnpm@10.34.7");
    assert.equal(
      (await readFile(resolve(directory, values["node-version-file"]), "utf8")).trim(),
      "22.22.1",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("real native selection preserves repeated metadata, seeded samples and literal argument boundaries", async () => {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP, "native caller "));
  try {
    const config = join(directory, "promptfooconfig.yaml");
    const marker = join(directory, "must-not-exist");
    const literal = `$(touch '${marker}')`;
    const selected = Array.from({ length: 6 }, (_, index) => ({
      description: `Required case ${index + 1}`,
      metadata: { suite: "required", language: "latin" },
      vars: { index },
      assert: [{ type: "equals", value: literal }],
    }));
    await writeFile(
      config,
      stringify({
        prompts: ["{{literal}}"],
        providers: ["echo"],
        tests: [
          ...selected,
          {
            description: "Wrong language",
            metadata: { suite: "required", language: "other" },
            assert: [{ type: "equals", value: "wrong" }],
          },
          {
            description: "Wrong suite",
            metadata: { suite: "optional", language: "latin" },
            assert: [{ type: "equals", value: "wrong" }],
          },
        ],
      }),
    );
    const args = [
      "--filter-metadata",
      "suite=required",
      "--filter-metadata",
      "language=latin",
      "--filter-pattern",
      "Required case",
      "--filter-providers",
      "echo",
      "--filter-sample",
      "2",
      "--filter-sample-seed",
      "17",
      "--var",
      `literal=${literal}`,
      "--no-cache",
    ];
    const results = [];
    for (let i = 0; i < 2; i++) {
      const run = await evaluate(directory, config, args);
      assert.equal(run.status, 0, run.stdout + run.stderr);
      assert.equal(run.values["evaluation-status"], "pass");
      const rows = (await json(run.values["result-path"])).results.results;
      assert.equal(rows.length, 2);
      assert.ok(rows.every((row) => row.success && row.response.output === literal));
      assert.equal((run.stdout.match(/Completed \d+/g) ?? []).length, 2);
      assert.ok(!run.stdout.includes(literal) && !run.summary.includes(literal));
      results.push(rows.map((row) => row.testCase.description));
    }
    assert.deepEqual(results[0], results[1]);
    assert.equal(existsSync(marker), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a private argument file reaches native evaluation without appearing in public output", async () => {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP, "private caller "));
  try {
    const secret = "PRIVATE_ARGUMENT_AND_ANSWER";
    const config = join(directory, "promptfooconfig.yaml");
    const argsFile = join(directory, "private args.json");
    await writeFile(
      config,
      stringify({
        prompts: ["{{private_value}}"],
        providers: ["echo"],
        tests: [{ description: "-case", assert: [{ type: "equals", value: secret }] }],
      }),
    );
    await writeFile(
      argsFile,
      JSON.stringify([
        "--var",
        `private_value=${secret}`,
        "--filter-pattern",
        "-case",
        "--no-cache",
      ]),
      { mode: 0o600 },
    );
    const run = await evaluate(directory, config, [], { OMP_ARGS_FILE: argsFile });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.equal(run.values["evaluation-status"], "pass");
    assert.equal(
      (await json(run.values["result-path"])).results.results[0].response.output,
      secret,
    );
    assert.ok(!(run.stdout + run.stderr + run.summary).includes(secret));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("assertion failure retains raw results and makes an approved redacted artifact with a retention-aware footer", async () => {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP, "failed caller "));
  try {
    const config = join(directory, "promptfooconfig.yaml");
    const provider = join(directory, "unmeasured.mjs");
    await writeFile(
      provider,
      "export default class { id(){return 'unmeasured'} async callApi(prompt){return {output:prompt}} }",
    );
    await writeFile(
      config,
      stringify({
        description: "Public suite",
        prompts: ["PRIVATE_ANSWER"],
        providers: [`file://${provider}`],
        env: { ARTIFACT_CANARY_TOKEN: "artifact-secret-canary" },
        tests: [
          {
            description: "A required assertion",
            vars: { secret: "artifact-secret-canary" },
            assert: [{ type: "equals", value: "different" }],
          },
        ],
      }),
    );
    const run = await evaluate(directory, config, ["--no-cache"]);
    assert.equal(run.status, 1);
    assert.equal(run.values["evaluation-status"], "fail");
    assert.equal(run.values["evaluation-exit-code"], "100");
    assert.equal(run.values["results-available"], "true");
    assert.ok(existsSync(run.values["log-path"]));
    assert.ok((await readFile(run.values["result-path"], "utf8")).includes("PRIVATE_ANSWER"));
    assert.ok(run.summary.includes("## Evals — ❌ FAIL") && run.summary.includes("unknown"));
    assert.ok(!run.stdout.includes("PRIVATE_ANSWER") && !run.summary.includes("PRIVATE_ANSWER"));
    const output = join(directory, "artifact-output");
    const env = {
      OMP_REPORTING_PATH: reporting,
      OMP_RESULT_PATH: run.values["result-path"],
      OMP_RESULT_DIRECTORY: run.values["artifact-directory"],
      OMP_ARTIFACT_RETENTION_DAYS: "0",
      GITHUB_OUTPUT: output,
    };
    const child = shell(
      action.runs.steps.find((s) => s.id === "scored"),
      directory,
      env,
    );
    assert.equal(child.status, 0, child.stderr);
    const artifact = await readFile(outputs(await readFile(output, "utf8")).path, "utf8");
    assert.ok(!artifact.includes("artifact-secret-canary"));
    assert.ok(
      artifact.includes("PRIVATE_ANSWER") &&
        JSON.parse(artifact).results.results[0].gradingResult.reason,
    );
    for (const [requested, maximum, expected] of [
      ["0", "90", "90 days"],
      ["14", "90", "14 days"],
      ["180", "90", "90 days"],
      ["0", "", "repository settings"],
    ]) {
      const summary = join(directory, `footer-${requested}-${maximum}.md`);
      await writeFile(summary, "## Evals — ❌ FAIL\n");
      const footer = shell(
        action.runs.steps.find((s) => s.name === "Link the scored result in the suite card"),
        directory,
        {
          ...env,
          OMP_SUMMARY_PATH: summary,
          GITHUB_STEP_SUMMARY: summary,
          OMP_ARTIFACT_URL: "https://github.com/example/evals/actions/runs/1/artifacts/2",
          OMP_ARTIFACT_RETENTION_DAYS: requested,
          GITHUB_RETENTION_DAYS: maximum,
        },
      );
      assert.equal(footer.status, 0, footer.stderr);
      const text = await readFile(summary, "utf8");
      assert.ok(text.startsWith("## Evals — ❌ FAIL") && text.includes(expected));
      assert.equal((text.match(/Agent output and judge reasons/g) ?? []).length, 1);
      assert.ok(!text.includes("PRIVATE_ANSWER"));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("provider errors and zero coverage remain failing gates with unknown candidate cost", async () => {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP, "error caller "));
  try {
    const provider = join(directory, "provider.mjs");
    await writeFile(
      provider,
      "export default class { id(){return 'unmeasured'} async callApi(){return {error:'PRIVATE_TRANSPORT_REASON'}} }",
    );
    const config = join(directory, "promptfooconfig.yaml");
    await writeFile(
      config,
      stringify({
        prompts: ["PRIVATE_ANSWER"],
        providers: [`file://${provider}`],
        tests: [{ metadata: { suite: "required" }, assert: [{ type: "equals", value: "ready" }] }],
      }),
    );
    for (const args of [["--no-cache"], ["--filter-metadata", "suite=absent", "--no-cache"]]) {
      const run = await evaluate(directory, config, args);
      assert.equal(run.status, 1);
      assert.equal(run.values["evaluation-status"], "error");
      assert.ok(existsSync(run.values["log-path"]) && existsSync(run.values["report-path"]));
      assert.ok(run.summary.includes("unknown"));
      assert.ok(
        !run.stdout.includes("PRIVATE_") &&
          !run.stderr.includes("PRIVATE_") &&
          !run.summary.includes("PRIVATE_"),
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
