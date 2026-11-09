# Usage and reference

Run one checked-in native Promptfoo config and publish a GitHub job summary. Native
results and private diagnostics remain available when assertions fail. Scored-result
uploads are explicitly enabled by the caller.

The evaluation runner, providers, graders and reporting/accounting helpers belong
to [oh-my-promptfoo](https://github.com/allagentsdev/oh-my-promptfoo). This repository
owns the root-level GitHub Action and its integration checks.

## Use from another repository

Replace `<reviewed-commit-sha>` with the full commit SHA of a reviewed
[Action release](https://github.com/allagentsdev/oh-my-promptfoo-action/releases).
Stable releases use immutable `vX.Y.Z` tags; `v1` tracks compatible 1.x releases.
Pinning the full SHA keeps the Action immutable. The config and its datasets belong to
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
With public labels enabled, stable `metadata.id` values identify cases, falling
back to descriptions. The assertion pass count counts nested criteria; aggregate
outcomes remain in the details. Grader prices use the package's documented
recorded-price method and require matching recorded model identity.

## Replay a scored result for formatting

Select the replay result provider at runtime to render an approved scored-result
JSON without making candidate or grader calls:

```yaml
- uses: allagentsdev/oh-my-promptfoo-action@<reviewed-commit-sha>
  with:
    execution-mode: replay
    replay-results: .recording/scored-results.json
    config: evals/release/promptfooconfig.yaml
    public-labels: "true"
```

Download the capture from the calling repository's approved artifact storage
before this step. Check out the recorded suite revision for accurate source
links. The config is source context only: replay never loads its providers,
reruns assertions or rebuilds an agent workspace. Keep captures containing raw
answers and judge reasons private; do not commit them to this public repository.

Replay uses the package's existing local reporter, labels the summary and console
as recorded, and preserves saved native per-case outcomes and measurements.
Latency, tokens and costs describe the original run. The `replayed` output is
`true`; the native CLI exit code is `unknown` because no native CLI ran. For
exports without an original process exit code, the existing conservative
report-only gate applies. Recorded failures, errors, invalid files and zero
coverage keep failing. Replay is a formatting check, not a fresh release gate.

Native argument filters apply to live evaluation. Replay renders the entire
saved export and requires an empty `args-json` array and no `args-file`. An
invalid mode or a replay file supplied in live mode fails before any evaluation.
The default remains `execution-mode: live`; replay never falls back to live
calls. Uploads remain opt-in in both modes.

## Fixed release regression

The credential-free [release suite](../examples/ci/release/promptfooconfig.yaml)
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

The [comparison example](../examples/ci/comparison.yaml) compares OpenAI's
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

### Use packages installed by the caller

For environments that require their own dependency installation and registry
controls, install exact `oh-my-promptfoo@1.30.2` and `promptfoo@0.125.1` pins through
your checked-in manifest/lockfile and approved registry before this step:

```yaml
- uses: allagentsdev/oh-my-promptfoo-action@<reviewed-commit-sha>
  with:
    toolchain-mode: installed
    dependency-directory: evals/node_modules
    config: evals/release/promptfooconfig.yaml
    public-labels: "true"
```

Installed mode skips pnpm setup, source cloning, dependency installation and
building. It verifies the exact package version, the Promptfoo version resolved
by that package, its public CLI binary and its public reporting export against
[toolchain.json](../toolchain.json). Missing or mismatched installations fail before
evaluation, with no source or registry fallback. The caller owns provider/SDK
installation, lockfiles, credentials and registry policy. Node remains pinned by
the Action. This mode supports both live evaluation and recorded replay.

The default `source` mode builds the reviewed immutable source and frozen
lockfile, including any explicit source dependencies in that lockfile. Its registry
installs inherit caller configuration; installs fail without retrying a different
feed. Select installed mode when the caller must own the entire dependency route.

| Input                     | Default               | Purpose                                                                                       |
| ------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `toolchain-mode`          | `source`              | Build reviewed source, or verify/use exact caller-installed packages with `installed`         |
| `dependency-directory`    | Empty                 | Caller node_modules directory relative to working-directory; required only for installed mode |
| `config`                  | Required              | One native config, relative to `working-directory`                                            |
| `execution-mode`          | `live`                | `live` evaluates; `replay` renders saved scored results without model calls                   |
| `replay-results`          | Empty                 | Native scored-result JSON relative to `working-directory`, required only for replay           |
| `args-json`               | `[]`                  | JSON array of native argument strings; use only public values because GitHub prints inputs    |
| `args-file`               | Empty                 | Private JSON argument-array file, relative to `working-directory`                             |
| `working-directory`       | `.`                   | Caller directory from which to run Promptfoo                                                  |
| `output-directory`        | `.promptfoo-ci`       | Parent of a fresh invocation directory                                                        |
| `public-labels`           | `false`               | Approve suite/test/provider/assertion labels and source paths in summaries                    |
| `upload-results`          | `false`               | Approve a credential-redacted scored-result artifact in the calling repository                |
| `artifact-retention-days` | `0`                   | Use repository retention; a positive override is capped by repository policy                  |
| `artifact-name`           | Generated unique name | Optional unique upload name                                                                   |
| `suite-number`            | `1`                   | Legacy JSON reference; never displayed in suite cards                                         |

With public labels enabled, an assertion uses its metric name. Unnamed `skill-used`
and `not-skill-used` checks use their string skill target; other unnamed checks
keep a numbered fallback. Other assertion values remain private.

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

[toolchain.json](../toolchain.json) pins the exact public `oh-my-promptfoo` source
commit containing the eval/report CLI and replay support. The Action fetches
that immutable commit into a fresh
runner temporary directory, installs its frozen lockfile without dependency
scripts, then builds and invokes the package. It does not execute a floating
branch or latest npm version. Node 22.22.1, pnpm 10.34.7 and Promptfoo 0.125.1 are
pinned. GitHub credentials are not needed to fetch the public source.

Dependency installs inherit the caller's package-manager configuration, including
`NPM_CONFIG_REGISTRY` and `NPM_CONFIG_USERCONFIG`. Configure an approved registry
and its credentials before invoking the Action. Install or authentication failures
fail the Action; it does not retry another registry. The source and frozen lockfile
still own package versions and integrity hashes.

The same CLI and reporting helpers work locally; see the
[package's local reporting documentation](https://github.com/allagentsdev/oh-my-promptfoo/blob/f35e3d062ad1300dae1b4a997698b8a61fbf0051/docs/ci-action.md).
Package publication and Action tags are separate release decisions. To update
this Action's toolchain, change the source pin in a PR and pass all behavior and
hosted artifact checks before publishing a new Action commit/tag. Keep the tested
dependency versions together; do not substitute a floating source ref.

## Action releases

Publish from a reviewed `main` commit after the Action behavior and hosted artifact
checks pass. Update this changelog, create the immutable version tag and GitHub
release, then advance the matching major tag. Consumers should pin the release's
full commit SHA; moving major tags are available for callers that opt into updates.
Action releases do not publish the provider package to npm.

### GitHub Marketplace

The repository contains one root Action, named **oh-my-promptfoo Evals**. To list
a verified release, edit that release on GitHub, select **Publish this Action to
the GitHub Marketplace**, choose **Testing** as its primary category, and update
the release. An organization owner must accept the Marketplace Developer Agreement
before the first listing; GitHub also requires two-factor authentication.

Tags and GitHub releases can be automated through the public API. GitHub's
documented Marketplace publication step uses the release web form; its public
Releases API exposes no Marketplace publication field. See
[GitHub's publication guide](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace).

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
