# Contributing

- Node.js 22. `npm ci`, then `npm test` must pass (the suite grows with most changes; the current count is in the test output).
- `npm run build` builds the sample portal into `site/` (needs `data/records.json`; copy `data/records.sample.json` for a try-out).
- Group related improvements into one coherent PR; describe the full scope and how you checked it.
- Code is AGPL-3.0 (see LICENSE); data sources keep their own licences and stay credited in CREDITS.md.

## Pull request rules

- GitHub is English-only: PR titles, descriptions, comments, review threads and commit messages. Product content (UI text, game or site copy) keeps its own language.
- Every PR needs: a clear title, what and why, how it was tested, risk and rollback, links to related issues or PRs, and screenshots when the UI changes.
- Do not mix languages in the same PR.
- One coherent task or release per PR: batch related changes instead of splitting each adjustment into a small PR. Keep the whole batch reviewable; separate independent risks.
- No direct pushes to the default branch for shared work: open a PR and wait for review and green CI before merging.

## PR batches and GitHub Actions minutes

- Prefer large, coherent PRs: group related changes for one task or release into one PR per repository. Do not open a PR for every adjustment, file or test. Split only for independent risks, necessary dependencies or a batch that cannot be reviewed safely. Do not add unrelated changes just to make a PR larger.
- Prepare the batch and inspect the local diff before publishing. Group review fixes into a deliberate push instead of pushing every edit. A draft PR can still run Actions; draft status is not a cost control.
- Before the final push, check scope, files, included tests and documentation. Use local checks that add useful evidence for the change; do not repeat full suites without a specific CI coverage gap.
- Merge approval and green CI must cover the exact final head SHA. A later change requires review of the new diff and its checks. Do not merge with pending, failed or cancelled CI; a green run on an older head does not validate the new one.
- Preserve required checks and security coverage. Do not use CI skips, draft conditions, path filters or renamed checks to bypass them. Full CI on the final head is the closing validation, not permission to disable runs the repository requires.
- Propose workflow changes in a reviewed change: remove duplicate jobs only after proving equivalent coverage; use per-PR/ref concurrency and cancel-in-progress for obsolete read-only checks. Do not cancel deployments, migrations, payments or other side-effecting jobs midway.
- Use path filters only with demonstrated coverage of code, dependencies, configuration and tests, preserving required checks and security scans. A filter must not leave a required check waiting forever. This policy does not itself change any workflow.
- Before a rerun, check for an active or green run on the same SHA, or a newer head on the same branch that already contains the change. Do not rerun an obsolete head cancelled by concurrency. Retry only for an identified transient failure; fix and review a real failure instead of rerunning until green.
- Record the batch scope, any reason for splitting, test results, final SHA, risks and rollback. Include visual evidence for visible changes.
- Merge requires an independent passing review of the exact head and green CI. Batching never authorizes a deployment, permission change or spending. Existing deployment gates and limits stay unchanged.
