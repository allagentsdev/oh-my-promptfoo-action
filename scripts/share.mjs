import { spawn } from "node:child_process";
import { appendFile, mkdir, open, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { publicUrl } from "./links.mjs";

const env = process.env;
try {
  const directory = resolve(env.OMP_RESULT_DIRECTORY);
  const profile = join(directory, "share-profile");
  await mkdir(profile, { mode: 0o700 });
  const { prepareResultArtifact } = await import(pathToFileURL(env.OMP_REPORTING_PATH));
  const result = join(profile, "scored-results.json");
  await prepareResultArtifact(env.OMP_RESULT_PATH, result);
  const logPath = join(directory, "share.log");
  const log = await open(logPath, "wx", 0o600);
  try {
    // Public CLI commands own import, storage and upload. This isolated profile
    // contains only this export; no user login or previous evaluation is reused.
    for (const args of [["import", result, "--new-id"], ["share"]]) {
      await new Promise((resolveChild, reject) => {
        const child = spawn(process.execPath, [env.OMP_PROMPTFOO_CLI, ...args], {
          cwd: profile,
          env: { ...env, PROMPTFOO_CONFIG_DIR: profile, FORCE_COLOR: "0", CI: "true" },
          stdio: ["ignore", log.fd, log.fd],
          timeout: 120_000,
        });
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0 ? resolveChild() : reject(new Error("Native sharing failed")),
        );
      });
    }
  } finally {
    await log.close();
  }
  const matches = [
    ...stripVTControlCharacters(await readFile(logPath, "utf8")).matchAll(
      /View results:\s+(https?:\/\/\S+)/g,
    ),
  ];
  if (!matches.length) throw new Error("Native sharing did not return a viewer URL");
  const url = publicUrl(matches.at(-1)[1]);
  const delimiter = crypto.randomUUID();
  await appendFile(env.GITHUB_OUTPUT, `viewer-url<<${delimiter}\n${url}\n${delimiter}\n`);
  const note = `\n[Open the Promptfoo viewer](<${url}>).\n`;
  for (const path of new Set([env.OMP_SUMMARY_PATH, env.GITHUB_STEP_SUMMARY].filter(Boolean)))
    await appendFile(path, note);
  console.log("Promptfoo viewer link added to the suite summary.");
} catch {
  console.error(
    "Promptfoo sharing failed. Inspect the private share.log in the result directory and the caller's sharing configuration.",
  );
  process.exitCode = 1;
}
