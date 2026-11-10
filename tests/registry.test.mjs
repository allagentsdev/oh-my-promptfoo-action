import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const root = resolve(import.meta.dirname, "..");
const execute = promisify(execFile);

test("the real frozen toolchain install uses the caller registry and fails its auth errors without fallback", async () => {
  const directory = await mkdtemp(join(tmpdir(), "action-registry-"));
  const name = "promptfoo";
  const repo = join(directory, "source");
  const action = join(directory, "action");
  const archive = join(directory, "probe.tgz");
  const packageDirectory = join(directory, "package");
  let rejected = false;
  let metadataRequests = 0;
  let archiveRequests = 0;
  let rejectedRequests = 0;
  const server = createServer((request, response) => {
    if (rejected) {
      rejectedRequests++;
      response.writeHead(401);
      response.end("Fixture registry rejects authentication");
    } else if (request.url.endsWith(".tgz")) {
      archiveRequests++;
      response.end(tarball);
    } else {
      metadataRequests++;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          name,
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              name,
              version: "1.0.0",
              dist: {
                tarball: `${registry}/${name}/-/${name}-1.0.0.tgz`,
                integrity,
              },
            },
          },
        }),
      );
    }
  });
  let tarball;
  let integrity;
  let registry;
  try {
    await mkdir(packageDirectory);
    await mkdir(repo);
    await mkdir(join(action, "scripts"), { recursive: true });
    await writeFile(
      join(packageDirectory, "package.json"),
      JSON.stringify({
        name,
        version: "1.0.0",
        main: "index.cjs",
        bin: { promptfoo: "index.cjs" },
      }),
    );
    await writeFile(
      join(packageDirectory, "index.cjs"),
      "module.exports = 'installed-from-caller-registry';\n",
    );
    execFileSync("tar", ["-czf", archive, "-C", directory, "package"]);
    tarball = await readFile(archive);
    integrity = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    registry = `http://127.0.0.1:${server.address().port}`;
    const audit = join(directory, "network-attempts");
    const guard = join(directory, "network-guard.cjs");
    await writeFile(
      guard,
      `const net = require('node:net');
const fs = require('node:fs');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) {
  let first = args[0];
  if (Array.isArray(first)) first = first[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    fs.appendFileSync(process.env.REGISTRY_NETWORK_AUDIT, host + '\\n');
    throw new Error('Registry test blocked a non-fixture connection');
  }
  return connect.apply(this, args);
};\n`,
    );
    const env = { ...process.env };
    for (const key of Object.keys(env))
      if (/^(?:npm_config_|(?:http|https|all)_proxy$|node_auth_token$|npm_token$)/i.test(key))
        delete env[key];
    Object.assign(env, {
      CI: "true",
      NPM_CONFIG_REGISTRY: registry,
      NPM_CONFIG_USERCONFIG: "/dev/null",
      npm_config_fetch_retries: "0",
      REGISTRY_NETWORK_AUDIT: audit,
      NODE_OPTIONS: `--require=${guard}`,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    });
    await writeFile(audit, "");
    await writeFile(
      join(repo, "package.json"),
      JSON.stringify({
        name: "frozen-registry-fixture",
        private: true,
        packageManager: "pnpm@10.34.7",
        scripts: { build: "node build.cjs" },
        dependencies: { [name]: "1.0.0" },
      }),
    );
    await writeFile(
      join(repo, "build.cjs"),
      `const fs = require('node:fs');
fs.mkdirSync('packages/oh-my-promptfoo/dist', { recursive: true });
fs.writeFileSync('packages/oh-my-promptfoo/dist/registry-receipt.json', JSON.stringify({ value: require('${name}') }));\n`,
    );
    await execute("pnpm", ["install", "--lockfile-only", "--ignore-scripts"], {
      cwd: repo,
      env: { ...env, npm_config_store_dir: join(directory, "lock-store") },
      timeout: 30_000,
    });
    assert.ok(metadataRequests > 0, "The fixture must be resolved through the configured registry");
    assert.ok(
      !(await readFile(join(repo, "pnpm-lock.yaml"), "utf8")).includes("http"),
      "A registry-independent frozen lock must exercise registry selection on install",
    );
    for (const args of [
      ["init", "--quiet"],
      ["add", "package.json", "pnpm-lock.yaml", "build.cjs"],
      [
        "-c",
        "user.name=Registry Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      ],
    ])
      execFileSync("git", args, { cwd: repo, env });
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      env,
      encoding: "utf8",
    }).trim();
    await copyFile(
      join(root, "scripts/prepare-toolchain.mjs"),
      join(action, "scripts/prepare-toolchain.mjs"),
    );
    await writeFile(join(action, "toolchain.json"), JSON.stringify({ repository: repo, revision }));
    const run = async (label) => {
      const temporary = join(directory, label);
      await mkdir(temporary);
      const output = join(temporary, "outputs");
      await writeFile(output, "");
      const child = await execute(
        process.execPath,
        [join(action, "scripts/prepare-toolchain.mjs")],
        {
          cwd: directory,
          env: {
            ...env,
            RUNNER_TEMP: temporary,
            GITHUB_OUTPUT: output,
            npm_config_store_dir: join(directory, `${label}-store`),
          },
          timeout: 30_000,
        },
      );
      const lines = (await readFile(output, "utf8")).split("\n");
      const index = lines.findIndex((line) => line.startsWith("toolchain-directory<<"));
      assert.ok(index >= 0);
      return { ...child, source: lines[index + 1] };
    };
    const result = await run("accepted");
    assert.ok(
      archiveRequests > 0,
      "A fresh store must fetch the frozen dependency from the caller registry",
    );
    assert.deepEqual(
      JSON.parse(
        await readFile(join(result.source, "packages/oh-my-promptfoo/dist/registry-receipt.json")),
      ),
      { value: "installed-from-caller-registry" },
    );
    rejected = true;
    await assert.rejects(run("rejected"));
    assert.ok(rejectedRequests > 0, "Rejected authentication must reach the configured registry");
    assert.equal(
      await readFile(audit, "utf8"),
      "",
      "No install may attempt a public-feed fallback",
    );
  } finally {
    await new Promise((done) => server.close(done));
    await rm(directory, { recursive: true, force: true });
  }
});
