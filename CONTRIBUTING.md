# Contributing

- Node.js 22. `npm ci`, then `npm test` must pass (the suite grows with most changes; the current count is in the test output).
- `npm run build` builds the sample portal into `site/` (needs `data/records.json`; copy `data/records.sample.json` for a try-out).
- One improvement per PR; describe what changed and how you checked it.
- Code is AGPL-3.0 (see LICENSE); data sources keep their own licences and stay credited in CREDITS.md.

## Pull request rules

- GitHub is English-only: PR titles, descriptions, comments, review threads and commit messages. Product content (UI text, game or site copy) keeps its own language.
- Every PR needs: a clear title, what and why, how it was tested, risk and rollback, links to related issues or PRs, and screenshots when the UI changes.
- Do not mix languages in the same PR.
- One topic per PR: keep the change focused and small enough to review.
- No direct pushes to the default branch for shared work: open a PR and wait for review and green CI before merging.
