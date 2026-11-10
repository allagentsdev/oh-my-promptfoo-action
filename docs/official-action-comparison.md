# Choosing a Promptfoo Action

Both Actions run native Promptfoo configs. Use ours when you want detailed results
inside GitHub, retained result artifacts and replay. The official Action is a good
fit when its existing workflow and reporting meet your needs.

| Capability                                   | Official Promptfoo Action                                     | oh-my-promptfoo Action                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Native configs and custom providers          | Yes                                                           | Yes                                                                                                                  |
| Exact Promptfoo version and disabled sharing | Supported inputs                                              | Reviewed toolchain; sharing disabled by default                                                                      |
| Case selection                               | Selected CLI inputs                                           | Native argument arrays or a private argument file, including repeated filters, sampling and seed                     |
| GitHub report                                | Aggregate PR comment, or job summary outside PRs              | Case and assertion details, numbered source links, scores versus thresholds and separate candidate/grader accounting |
| Results                                      | Internal JSON is deleted after parsing; no result-path output | Retained native JSON and diagnostics, exposed paths and optional scored artifact                                     |
| Replay                                       | No declared replay mode                                       | Render a scored export without candidate or grader calls                                                             |
| PR comments and viewer                       | Optional aggregate comment and native sharing                 | Optional sanitized comment, native sharing and confirmed result links                                                |
| Current external results                     | No result-path output                                         | Report-only mode carries the original process status without model calls                                             |
| Workflow helpers                             | Changed-prompt/dependency detection and cache metrics         | Caller chooses triggers, suites, matrix and cache persistence                                                        |

## What the PR comment and viewer provide

On a pull request, the official Action posts or updates a comment with aggregate
evaluation results. When sharing is enabled, it includes a link to the Promptfoo
viewer. Posting that link is straightforward. The useful part is the hosted viewer
behind it, where readers can inspect results interactively.

Our Action puts case and assertion details directly in the GitHub summary and links
to the approved scored artifact for answers and judge reasons. Optional PR comments
contain counts and links. Optional sharing uses the pinned native public CLI. Both
remain off by default; the caller supplies credentials and permissions.

## What should remain shared

Promptfoo owns providers, evaluation and native selection. The coding-agent
providers and graders in oh-my-promptfoo are reusable package features; callers can
use them with another Promptfoo runner too. The package reporter also accepts native
JSON from a direct CLI run.

This Action keeps evaluation, providers and scoring in Promptfoo. Caller workflows
own changed-file filtering and cache persistence. The [migration guide](migration.md)
maps official inputs and records deliberate differences, including reviewed toolchain
pins and the lack of a custom per-test M-of-N repeat gate.

The official Action does not currently expose arbitrary argument arrays or a retained
result-path output. Those interfaces would let us consider reusing its runner without
losing native selection or evaluating twice. Report-only mode supports a current
external CLI export and requires its original execution status. Historical replay
remains separate. There is no claim of a lossless drop-in replacement.

## Sources

Compared official commit `6a8612f15670b4d5a4d43e0d6fb221d84ab389d8` with our released
v1.1.1 and the compatibility additions documented here. This was source inspection,
not an execution of the official Action.

- [Official inputs](https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/action.yml)
- [Official execution and reporting](https://github.com/promptfoo/promptfoo-action/blob/6a8612f15670b4d5a4d43e0d6fb221d84ab389d8/src/main.ts#L574-L873)
- [Our released Action](https://github.com/allagentsdev/oh-my-promptfoo-action/blob/0ea3dc0cdcb611a1ca31e240ea5d1521a3665d51/action.yml)
