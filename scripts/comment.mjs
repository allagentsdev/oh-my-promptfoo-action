import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { publicUrl } from "./links.mjs";

const env = process.env;
try {
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, "utf8"));
  const number = event.pull_request?.number;
  if (!number) {
    console.log("PR comment skipped: this event has no pull request.");
  } else {
    if (!env.OMP_GITHUB_TOKEN) throw new Error("An explicit token is required");
    const author = (env.OMP_COMMENT_AUTHOR || "github-actions[bot]").toLowerCase();
    const report = JSON.parse(await readFile(env.OMP_REPORT_PATH, "utf8"));
    const badge = { pass: "✅ PASS", fail: "❌ FAIL", error: "⚠️ ERROR" }[report.status];
    if (!badge || !Number.isSafeInteger(number) || number < 1)
      throw new Error("Invalid report or pull request");
    const counts = ["pass", "fail", "error", "unknown"].map((key) => report.counts[key]);
    if (counts.some((count) => !Number.isSafeInteger(count) || count < 0))
      throw new Error("Invalid counts");
    const key = env.OMP_COMMENT_KEY || `${env.OMP_WORKING_DIRECTORY || "."}/${env.OMP_CONFIG}`;
    const marker = `<!-- oh-my-promptfoo:${createHash("sha256").update(key).digest("hex")} -->`;
    const run = publicUrl(
      `${env.GITHUB_SERVER_URL || "https://github.com"}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    );
    const links = [`[Workflow summary](<${run}#summary>)`];
    if (env.OMP_ARTIFACT_URL) links.push(`[Scored result](<${publicUrl(env.OMP_ARTIFACT_URL)}>)`);
    if (env.OMP_VIEWER_URL) links.push(`[Promptfoo viewer](<${publicUrl(env.OMP_VIEWER_URL)}>)`);
    const body = `${marker}\n### Evals — ${badge}\n\n${report.replayed ? "Recorded evaluation (replay).\n\n" : ""}${counts[0]} passed · ${counts[1]} failed · ${counts[2]} errors${counts[3] ? ` · ${counts[3]} unknown` : ""}\n\n${links.join(" · ")}\n`;
    const api = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
    const request = async (path, method = "GET", data) => {
      const response = await fetch(`${api}/repos/${env.GITHUB_REPOSITORY}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${env.OMP_GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error("GitHub comment request failed");
      return response.json();
    };
    let existing;
    for (let page = 1; !existing; page++) {
      const comments = await request(`/issues/${number}/comments?per_page=100&page=${page}`);
      existing = comments.find(
        (comment) =>
          comment.user?.login?.toLowerCase() === author && comment.body?.startsWith(marker),
      );
      if (comments.length < 100) break;
    }
    const comment = existing
      ? await request(`/issues/comments/${existing.id}`, "PATCH", { body })
      : await request(`/issues/${number}/comments`, "POST", { body });
    if (comment.user?.login?.toLowerCase() !== author)
      throw new Error("Set comment-author to the supplied token's GitHub login");
    const returned = new URL(comment.html_url);
    const anchor = returned.hash;
    if (!/^#issuecomment-\d+$/.test(anchor)) throw new Error("Invalid comment URL");
    returned.hash = "";
    const url = publicUrl(returned.href) + anchor;
    await appendFile(env.GITHUB_OUTPUT, `comment-url=${url}\n`);
    console.log("Evaluation PR comment updated.");
  }
} catch {
  console.error(
    "Evaluation PR comment failed. Check github-token, comment-author and the caller's pull-requests: write permission.",
  );
  process.exitCode = 1;
}
