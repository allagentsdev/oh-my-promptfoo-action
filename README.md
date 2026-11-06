# oh-my-promptfoo-action

Run one checked-in native Promptfoo config and publish a GitHub job summary. Native
results and private diagnostics remain available when assertions fail. Scored-result
uploads are explicitly enabled by the caller.

The evaluation runner, providers, graders and reporting/accounting helpers belong
to [oh-my-promptfoo](https://github.com/allagentsdev/oh-my-promptfoo). This repository
owns the root-level GitHub Action and its integration checks.

## Use from another repository

Replace `<reviewed-commit-sha>` with a reviewed commit from this repository. No
Action release tag has been published yet. The config and its datasets belong to
the calling repository. Install the caller's locked dependencies first if its
config references packages. Credentials and workflow permissions are the caller's
responsibility.

```yaml
name: Release evals
on: [pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  eval:
    name: Run Evals - Required release regression
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: allagentsdev/oh-my-promptfoo-action@<reviewed-commit-sha>
        id: eval
        with:
          config: evals/release/promptfooconfig.yaml
          public-labels: "true"
          upload-results: "true"
          args-json: '["--filter-metadata", "suite=required", "--no-cache"]'
```

Use one suite per named job, or a workflow matrix. GitHub groups step summaries by
job, so separate jobs produce separate suite cards. The summary heading is
`Evals — ✅ PASS` (or FAIL/ERROR), with numbered test links to complete static
YAML/JSON test blocks, native scores against authored thresholds, per-assertion
details, latency, and separate candidate/grader usage and cost. Missing
measurements and failed-grader spend remain unknown. Costs use four decimal
places, with more precision when positive spend would otherwise display as zero.

## Fixed release regression

The credential-free [release suite](examples/ci/release/promptfooconfig.yaml)
contains four authored name-normalization tests. Its provider explicitly reports
zero model usage and cost. To run it, check out this repository and use `./` as
the Action, with:

```yaml
with:
  config: examples/ci/release/promptfooconfig.yaml
  public-labels: "true"
  args-json: '["--filter-metadata", "suite=required", "--filter-metadata", "language=latin", "--no-cache"]'
```

Run every required case for a release gate; do not sample. Keep cases, expected
answers, rubrics and thresholds in native Promptfoo resources. The Action honors
native assertion outcomes and the authored scoring policy. Provider/grader errors,
missing/invalid results and zero coverage fail the gate.

## Offline model comparison using OpenAI

The [comparison example](examples/ci/comparison.yaml) compares OpenAI's
`gpt-4.1-mini` and `gpt-4.1` against the same dataset and assertions. It sends the
selected cases to OpenAI, requires an `OPENAI_API_KEY` and can incur API charges.
Here, offline means evaluation on a fixed dataset rather than live traffic; it
does not mean disconnected execution. These native arguments select the same two
sampled cases with seed 17:

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
with:
  config: examples/ci/comparison.yaml
  args-json: '["--filter-sample", "2", "--filter-sample-seed", "17", "--no-cache"]'
```

For model comparisons, pin the dataset revision, selected cases and scoring for
every candidate. A seed does not pin a changing dataset or its ordering and does
not implement live traffic A/B assignment. Native description/provider filters,
ranges, repeated metadata filters, sampling and seeds pass through as individual
argument strings. Caller arguments are never evaluated as shell code. Config,
output and sharing ownership stay with the Action.

## Inputs

| Input                     | Default               | Purpose                                                                                    |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| `config`                  | Required              | One native config, relative to `working-directory`                                         |
| `args-json`               | `[]`                  | JSON array of native argument strings; use only public values because GitHub prints inputs |
| `args-file`               | Empty                 | Private JSON argument-array file, relative to `working-directory`                          |
| `working-directory`       | `.`                   | Caller directory from which to run Promptfoo                                               |
| `output-directory`        | `.promptfoo-ci`       | Parent of a fresh invocation directory                                                     |
| `public-labels`           | `false`               | Approve suite/test/provider/assertion labels and source paths in summaries                 |
| `upload-results`          | `false`               | Approve a credential-redacted scored-result artifact in the calling repository             |
| `artifact-retention-days` | `0`                   | Use repository retention; a positive override is capped by repository policy               |
| `artifact-name`           | Generated unique name | Optional unique upload name                                                                |
| `suite-number`            | `1`                   | Legacy JSON reference; never displayed in suite cards                                      |

## Outputs and privacy

`evaluation-status` is `pass`, `fail` or `error`; `evaluation-exit-code` preserves
the native exit code. `results-available` reports whether the native JSON was
produced and parsed; it does not prove valid coverage. `result-path`,
`artifact-directory`, `log-path`, `report-path` and `summary-path` expose absolute
runner paths for caller-approved storage, including assertion failures. Setup
failure or runner cancellation can prevent outputs from being produced.

Raw answers, judge reasons, generated-file contents and credentials stay out of
public summaries/logs. Raw JSON and diagnostics remain private on the runner.
There is no Promptfoo Cloud sharing, stored-login/PAT fallback or permission
escalation. When `upload-results` is true, the artifact intentionally contains
native answers and judge reasons with known credentials redacted; approve it only
for the calling repository's audience. Original files are preserved.

A confirmed upload supplies `result-artifact-url` and `result-artifact-id` and
adds: “Agent output and judge reasons: download the scored result (expires in N
days).” Retention comes from the calling repository unless overridden. Failed
uploads produce no placeholder link. Artifact upload uses the official pinned
`actions/upload-artifact`; that service's runner/platform restrictions apply.

## Pinned toolchain and local use

[toolchain.json](toolchain.json) pins the exact public `oh-my-promptfoo` source
commit containing the eval/report CLI. The current published npm package does not
yet contain those exports. The Action fetches that immutable commit into a fresh
runner temporary directory, installs its frozen lockfile without dependency
scripts, then builds and invokes the package. It does not execute a floating
branch or latest npm version. Node 22.22.1, pnpm 10.34.7 and Promptfoo 0.125.1 are
pinned. GitHub credentials are not needed to fetch the public source.

The same CLI and reporting helpers work locally; see the
[package's local reporting documentation](https://github.com/allagentsdev/oh-my-promptfoo/blob/7b4a47ae068a4a7be4da22802265c2663bd18140/docs/ci-action.md).
Package publication and Action tags are separate release decisions. To update
this Action's toolchain, change the source pin in a PR and pass all behavior and
hosted artifact checks before publishing a new Action commit/tag. Keep the tested
dependency versions together; do not substitute a floating source ref.

## Development

Use the pinned Node/pnpm versions, then:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm lint
node scripts/prepare-toolchain.mjs
```

`prepare-toolchain.mjs` requires GitHub-style `RUNNER_TEMP` and `GITHUB_OUTPUT`
paths. Set `OMP_TOOLCHAIN_DIRECTORY` to its `toolchain-directory` output and run
`pnpm test`. Tests execute the actual Action shell steps and public native CLI.
CI also runs the whole composite Action, checks source links and uploads approved
artifacts for passing and deliberately failing suites. No model credentials or
paid model calls are required.
