# Choosing a Promptfoo Action

Both Actions run native Promptfoo configs. Use ours when you want detailed results
inside GitHub, retained result artifacts and replay. The official Action is a good
fit when its existing workflow and reporting meet your needs.

| Capability                                   | Official Promptfoo Action                                     | oh-my-promptfoo Action                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Native configs and custom providers          | Yes                                                           | Yes                                                                                                                  |
| Exact Promptfoo version and disabled sharing | Supported inputs                                              | Reviewed toolchain; sharing disabled                                                                                 |
| Case selection                               | Selected CLI inputs                                           | Native argument arrays or a private argument file, including repeated filters, sampling and seed                     |
| GitHub report                                | Aggregate PR comment, or job summary outside PRs              | Case and assertion details, numbered source links, scores versus thresholds and separate candidate/grader accounting |
| Results                                      | Internal JSON is deleted after parsing; no result-path output | Retained native JSON and diagnostics, exposed paths and optional scored artifact                                     |
| Replay                                       | No declared replay mode                                       | Render a scored export without candidate or grader calls                                                             |
| Workflow helpers                             | Changed-prompt detection and PR comments                      | Caller chooses triggers, suites and matrix                                                                           |

## What the PR comment and viewer provide

On a pull request, the official Action posts or updates a comment with aggregate
evaluation results. When sharing is enabled, it includes a link to the Promptfoo
viewer. Posting that link is straightforward. The useful part is the hosted viewer
behind it, where readers can inspect results interactively.

Our Action puts case and assertion details directly in the GitHub summary and links
to the approved scored artifact for answers and judge reasons. It does not currently
post a PR comment or enable Promptfoo sharing.

## What should remain shared

Promptfoo owns providers, evaluation and native selection. The coding-agent
providers and graders in oh-my-promptfoo are reusable package features; callers can
use them with another Promptfoo runner too. The package reporter also accepts native
JSON from a direct CLI run.

We should keep this Action focused on reporting, retained results, safe progress and
replay. Changed-file discovery, a PR-comment engine and a second scoring policy would
add maintenance without improving that purpose.

The official Action does not currently expose arbitrary argument arrays or a retained
result-path output. Those interfaces would let us consider reusing its runner without
losing native selection or evaluating twice. A future report-only Action mode could
also serve callers that already run the CLI themselves; it would need to preserve the
original execution status and stay distinct from historical replay.

## Sources

Compared official commit `6a8612f15670b4d5a4d43e0d6fb221d84ab389d8` with our released
v1.1.1. This was source inspection, not an execution of the official Action.

- [Official inputs](https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/action.yml)
- [Official execution and reporting](https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/src/main.ts#L574-L873)
- [Our released Action](https://github.com/allagentsdev/oh-my-promptfoo-action/blob/0ea3dc0cdcb611a1ca31e240ea5d1521a3665d51/action.yml)
