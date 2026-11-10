# Changelog

## Unreleased

- Clarify which responsibilities belong to the Action and which stay in caller workflows. Describe supported official Action mappings without promising every helper input.

- Add optional sanitized PR comments and native Promptfoo viewer sharing. Keep both off by default, use explicit caller credentials, and expose their confirmed URLs.

- Report a current external native evaluation with its original exit code, preserving failures, runtime errors and native scoring policy without rerunning models. Document official Action migration mappings, workflow filtering, persistent caching and remaining gaps.

- Use the reviewed source reporter to explain unavailable measurements and show collapsed execution timing. Measure runtime preparation through the existing evaluation environment.

- Keep the README focused on getting started, with the full reference and a source-backed comparison with the official Promptfoo Action under docs/.

## 1.1.1 - 2026-11-09

- Use the reviewed reporter that names unlabelled `skill-used` and `not-skill-used` checks after their string skill targets when public labels are enabled. Keep explicit metrics first and other assertion values private.

## 1.1.0 - 2026-11-09

- Use exact caller-installed public packages with `toolchain-mode: installed` and `dependency-directory`, skipping source cloning, dependency installation and building. Verify the package's public CLI/reporting exports and its resolved Promptfoo version against the reviewed pins; reject missing or mismatched installations without a fallback.

- Respect caller package-registry and authentication configuration when installing the frozen toolchain. Fail registry errors without a public-feed fallback; cover successful routing and rejected authentication through a real credential-free registry fixture.

## 1.0.1 - 2026-11-09

- Name the root Action `oh-my-promptfoo Evals` and document Marketplace publication, independent stable semantic versions and immutable SHA pinning.

- Use the shared reporter's nested criterion counts, approved stable case IDs, and native rubric cost estimates based on recorded prices and model identity. Preserve unknown measurements, native verdicts and full test-block links.

## 1.0.0 - 2026-11-09

- Select live or replay execution at runtime. Replay reads an approved native scored-result file through the shared package reporter, skips candidate/grader calls and labels all measurements as historical. Live remains the default.

- Move the reusable native Promptfoo Action from `allagentsdev/oh-my-promptfoo` to this repository, keeping its existing inputs, outputs, private results, live completion lines, suite summaries and optional scored-result artifacts.
- Use the public CLI and reporting helpers from an immutable `oh-my-promptfoo` source commit and its frozen dependency lockfile. Evaluation, selection, scoring and accounting remain owned by Promptfoo and the package.
