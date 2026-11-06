# Changelog

## Unreleased

- Move the reusable native Promptfoo Action from `allagentsdev/oh-my-promptfoo` to this repository, keeping its existing inputs, outputs, private results, live completion lines, suite summaries and optional scored-result artifacts.
- Use the public CLI and reporting helpers from an immutable `oh-my-promptfoo` source commit and its frozen dependency lockfile. Evaluation, selection, scoring and accounting remain owned by Promptfoo and the package.
