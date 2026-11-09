# oh-my-promptfoo-action

Run a Promptfoo suite and read the results in GitHub Actions: numbered tests,
assertion outcomes, scores versus thresholds, latency and reported candidate and grader costs.
Promptfoo runs your checked-in config and owns selection and scoring.

## Get started

Add this workflow to the repository containing your eval suite:

```yaml
name: Evals
on: [pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  eval:
    name: Run Evals - Release regression
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: allagentsdev/oh-my-promptfoo-action@v1
        id: eval
        with:
          config: evals/release/promptfooconfig.yaml
          public-labels: "true"
          upload-results: "true"
```

Use your suite's config path. Pass provider credentials through the eval step's
`env` using repository secrets. Use one suite per job, or a matrix for several suites. Pin a reviewed
[release commit](https://github.com/allagentsdev/oh-my-promptfoo-action/releases)
in place of `v1` when you need an immutable workflow.

`public-labels` shows authored test and check names. `upload-results` adds a download
link for the scored result, including answers and judge reasons; enable it for your
repository's approved audience. Both options default to false. Results and reporting
remain available when assertions fail.

## Examples and reference

- [Native filters and fixed release gates](docs/usage.md#fixed-release-regression)
- [Replay a scored result without model calls](docs/usage.md#replay-a-scored-result-for-formatting)
- [Use packages installed by the caller](docs/usage.md#use-packages-installed-by-the-caller)
- [All inputs, outputs and artifact settings](docs/usage.md#inputs)
- [Comparison with the official Promptfoo Action](docs/official-action-comparison.md)
- [Local CLI, providers, graders and reporting](https://github.com/allagentsdev/oh-my-promptfoo)

The [official Promptfoo Action](https://github.com/promptfoo/promptfoo-action) may
already cover your workflow. This Action focuses on detailed GitHub reports,
retained artifacts, native argument arrays and replay.
