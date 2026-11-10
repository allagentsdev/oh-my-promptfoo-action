# Migrating from the official Promptfoo Action

Both Actions run authored native Promptfoo configs. This Action adds detailed GitHub
reports, retained results and replay. The input mapping below helps adapt an existing
workflow; this Action does not reproduce every official Action helper.

## What belongs in the Action

The Action runs one authored suite, reports native outcomes and retains results on
failure. The public package CLI provides the same evaluation and reporting locally.
Promptfoo owns selection, providers, assertions and scoring.

Caller workflows choose suites, triggers, matrix jobs, credentials, source preparation
and cache storage. Repository-specific source authorization and preparation checks
can remain around the Action without duplicating evaluation or reporting.

The toolchain stays pinned to reviewed versions. Cache persistence uses `actions/cache`;
the Action adds no automatic seven-day cleanup. Cache size and file-count outputs
are omitted and can be added if a consumer needs them. Native `--repeat` is supported,
but the Action adds no per-test M-of-N gate that changes the native result.

## Compare capabilities

Compared with official commit
[`6a8612f`](https://github.com/promptfoo/promptfoo-action/tree/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8).

| Official capability                                       | Current support                                | Behavior                                                                                          |
| --------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Native configs, datasets, assertions and custom providers | Supported                                      | Keep Promptfoo responsible for evaluation and authored scoring.                                   |
| Provider keys and environment files                       | Native environment variables and CLI arguments | Document the mapping; do not add stored-login or PAT fallbacks.                                   |
| Concurrency, repetition and cache disabling               | Native argument arrays                         | Preserve argument boundaries and repeated flags.                                                  |
| PR comments                                               | `post-comment: "true"`                         | Post or update sanitized counts and report links using only an explicitly supplied token.         |
| Promptfoo viewer sharing                                  | `share: "true"`                                | Use the pinned public CLI, expose the viewer URL and keep uploads disabled by default.            |
| Reporting an existing CLI run                             | `execution-mode: report`                       | Require its native exit code, preserve errors and failures, and never call candidates or graders. |
| Changed-prompt and dependency detection                   | Caller workflow                                | Explicit workflow path filters; no automatic dependency discovery.                                |
| Persistent cache                                          | Caller workflow                                | Use `actions/cache` with the native response-cache path.                                          |
| Cache metrics and cleanup                                 | No equivalent outputs                          | No cache size/file-count outputs or automatic age-based deletion.                                 |
| Exact arbitrary CLI version                               | Reviewed pinned toolchain                      | CLI and reporter versions are tested and pinned together.                                         |
| Aggregate success-rate threshold                          | Native pass-rate environment variable          | Document native policy without overriding critical errors or zero coverage.                       |
| Per-test `repeat-min-pass`                                | No equivalent                                  | Native repetitions retain their outcomes; no additional M-of-N scoring policy.                    |

## Acceptance checks

Comments, sharing and artifact uploads are optional. Public reports and comments
exclude answers, judge reasons, generated file contents and credentials. Missing
usage and failed-grader spend remain unknown. Failed evaluations still produce
reports and expose any retained results.

Report-only mode distinguishes a current external execution from historical
replay. A passing export cannot hide a runtime failure. Use one authored config per
invocation and a matrix for separate suites or candidates.
Seeded comparisons require the same pinned dataset, order, selected cases and scoring
for every candidate; sampling is not live traffic assignment.

## Map official inputs

| Official input                                                                | This Action                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`, `working-directory`                                                 | Same input names; one config per invocation.                                                                                                                                                                      |
| `github-token`                                                                | Same name, used only for explicitly enabled comments. Evaluation does not require a GitHub token.                                                                                                                 |
| `disable-comment`                                                             | Comments default off. Use `post-comment: "true"` to enable them.                                                                                                                                                  |
| `no-share`                                                                    | Sharing defaults off. Use `share: "true"` to enable it.                                                                                                                                                           |
| `openai-api-key`, `azure-api-key`, `anthropic-api-key`, `huggingface-api-key` | `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `HF_API_TOKEN` in the step's `env`.                                                                                                                |
| `aws-access-key-id`, `aws-secret-access-key`                                  | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in `env`.                                                                                                                                                            |
| `replicate-api-key`, `palm-api-key`, `vertex-api-key`                         | `REPLICATE_API_KEY`, `PALM_API_KEY`, `VERTEX_API_KEY` in `env`; use the native provider's documented current authentication when migrating older providers.                                                       |
| `cohere-api-key`, `mistral-api-key`, `groq-api-key`                           | `COHERE_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY` in `env`.                                                                                                                                                     |
| `env-files`                                                                   | Native `--env-file` arguments; pass one flag per file.                                                                                                                                                            |
| `max-concurrency`, `repeat`, `no-cache`, `no-table`, `no-progress-bar`        | Native `--max-concurrency`, `--repeat`, `--no-cache`, `--no-table`, `--no-progress-bar` in `args-json` or `args-file`. Native tables and progress stay in the private log; this Action prints sanitized progress. |
| `cache-path`                                                                  | `PROMPTFOO_CACHE_PATH` in `env`.                                                                                                                                                                                  |
| `fail-on-threshold`                                                           | Explicit native `PROMPTFOO_PASS_RATE_THRESHOLD` in `env`, as a percentage. Native outcomes remain visible; runtime and grader errors still fail.                                                                  |
| `prompts`, `use-config-prompts`                                               | Prompts stay in the authored config by default. An explicit native `--prompts` argument can override them. No automatic changed-file prompt override.                                                             |
| `workflow-files`, `workflow-base`, `force-run`                                | Caller workflow triggers and filtering. Manual dispatch runs the authored suite without a changed-file gate.                                                                                                      |
| `debug`                                                                       | No compatibility input; native diagnostics are retained privately.                                                                                                                                                |
| `promptfoo-version`                                                           | No arbitrary override. The reviewed toolchain pins the CLI and reporter together. Report-only mode can consume an existing export, subject to native export-format compatibility.                                 |
| `repeat-min-pass`                                                             | No equivalent in the pinned native CLI. `--repeat` repeats tests but does not supply an M-of-N policy. Keep an existing workflow if it requires this custom gate.                                                 |

The official `cache-size-mb` and `cache-file-count` outputs have no equivalents.
Native cache persistence is available through the example below; this Action does
not reproduce the official Action's cache measurement or seven-day cleanup helpers.

## Add a PR comment

Add these settings to an existing eval workflow. The caller grants the permission
and passes the job token explicitly:

```yaml
permissions:
  contents: read
  pull-requests: write
jobs:
  eval:
    name: Run Evals - Release regression
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: allagentsdev/oh-my-promptfoo-action@v1
        with:
          config: evals/release/promptfooconfig.yaml
          post-comment: "true"
          github-token: ${{ github.token }}
          comment-key: release
```

The Action updates the configured author's comment with the same key on subsequent runs. Set a
distinct `comment-key` for each suite or candidate in a matrix. The comment contains
counts and links, including the scored artifact or viewer when enabled. Detailed
case and assertion tables stay in the workflow summary. Outside a PR event,
commenting is skipped and reporting continues. A missing token or denied write fails
the requested integration; there is no PAT or stored-login fallback. Fork PR job
tokens can be read-only; leave commenting disabled in jobs without write permission.

`comment-author` defaults to `github-actions[bot]` for the job token. When supplying
a user or GitHub App token, set it to that token's GitHub user or App bot login.
The Action matches both author and key and checks the author returned by GitHub;
it does not update another integration's matching comment.

## Link the Promptfoo viewer

Approve sharing explicitly and provide your Promptfoo Cloud API key through a secret:

```yaml
- uses: allagentsdev/oh-my-promptfoo-action@v1
  id: eval
  env:
    PROMPTFOO_API_KEY: ${{ secrets.PROMPTFOO_API_KEY }}
  with:
    config: evals/release/promptfooconfig.yaml
    share: "true"
```

For a self-hosted viewer, configure the native `PROMPTFOO_REMOTE_API_BASE_URL` and
`PROMPTFOO_REMOTE_APP_BASE_URL` environment variables and its documented authentication.
The Action uses public `promptfoo import` and `promptfoo share` commands in a private,
isolated profile. It shares the existing credential-redacted export without rerunning
models. It does not read a stored local login. The confirmed `viewer-url` is added to
the summary and optional comment. Upload diagnostics remain in private `share.log`.

Sharing sends the evaluation snapshot, including answers and judge reasons, to the
configured Promptfoo service. It is separate from `upload-results`, which uses the
calling repository's GitHub artifact storage. Approve each destination independently.
See Promptfoo's [sharing documentation](https://www.promptfoo.dev/docs/usage/sharing/)
for cloud access controls and self-hosted configuration.

## Report a current external CLI run

Use the caller's checked-in, pinned Promptfoo installation, then pass the original
exit code to this Action. This example leaves model arguments and config ownership
with the calling workflow:

```yaml
- name: Evaluate with the caller's pinned Promptfoo
  id: native
  shell: bash
  run: |
    mkdir -p .promptfoo-ci
    set +e
    pnpm exec promptfoo eval --config evals/release/promptfooconfig.yaml --no-share --no-write --output .promptfoo-ci/native.json > .promptfoo-ci/native.log 2>&1
    native_exit=$?
    printf 'exit-code=%s\n' "$native_exit" >> "$GITHUB_OUTPUT"
    exit 0
- uses: allagentsdev/oh-my-promptfoo-action@v1
  if: ${{ !cancelled() }}
  with:
    execution-mode: report
    config: evals/release/promptfooconfig.yaml
    results: .promptfoo-ci/native.json
    native-exit-code: ${{ steps.native.outputs.exit-code || 'unknown' }}
    public-labels: "true"
```

Install the caller's locked dependencies before these steps. This mode does not
load the config's providers or rerun assertions. The config supplies source-link
context. There is no historical replay label; `replayed` is `false`.
The original CLI output stays in private `native.log`; the reporting step prints
sanitized outcomes.

Both source and installed modes support reporting current external runs. Installed
mode requires the exact published pins in [toolchain.json](../toolchain.json);
neither mode reruns models or falls back to a different toolchain.

The exit code is required: zero preserves the native scoring policy, 100 preserves
the standard native assertion-failure status, and runtime errors or `unknown` fail
the gate. Provider/grader errors, missing results and zero coverage fail regardless
of exit code. Argument filters belong to the original evaluation; report mode
requires empty `args-json` and no `args-file`. Use replay only for historical captures.

The official Action currently deletes its internal JSON export and exposes no
result path. Report-only mode therefore needs an export from your own CLI run; it
cannot recover that Action's deleted results through a supported output.

## Filter workflows and preserve the native cache

GitHub's native path filters cover simple changed-file workflows. Include every
suite dependency that should trigger regression tests; there is no automatic
dependency discovery. Manual dispatch always runs the suite:

```yaml
name: Evals
on:
  pull_request:
    paths: ["evals/**", "prompts/**", "src/**", "pnpm-lock.yaml", ".github/workflows/evals.yml"]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  eval:
    name: Run Evals - Release regression
    runs-on: ubuntu-latest
    env:
      PROMPTFOO_CACHE_PATH: ${{ runner.temp }}/promptfoo-response-cache
    steps:
      - uses: actions/checkout@v7
      - uses: actions/cache@v6
        with:
          path: ${{ env.PROMPTFOO_CACHE_PATH }}
          key: promptfoo-${{ runner.os }}-0.125.1-${{ hashFiles('pnpm-lock.yaml', 'evals/**', 'prompts/**', 'src/**') }}
      - uses: allagentsdev/oh-my-promptfoo-action@v1
        with:
          config: evals/release/promptfooconfig.yaml
```

Cache entries can contain answers. Enable persistence only for data approved for
the calling repository's cache storage. Cache only the response directory, not the
whole Promptfoo profile, credentials or evaluation artifacts. Pass native `--no-cache`
when every candidate must make fresh calls.

For the complete fixed release and paired seeded comparison examples, see
[release regression](usage.md#fixed-release-regression) and
[offline comparison](usage.md#offline-model-comparison-using-openai). Pin a reviewed
Action release commit for immutable use. PR comments, viewer sharing and current
external-run reporting require v1.2.0 or later.
