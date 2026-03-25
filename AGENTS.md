- Using superpowers skill
- Use red/green TDD
- First run the tests

Startup Baseline

- Root `npm test` is a placeholder echo, not real validation.
- Real baseline tests are in `client/`: run `npm test` there first.
- `client` test baseline: Vitest plus Storybook stories; currently green.
- `server` does not currently have a real test suite.

Game Client Visual TDD Rules

- Always start with Storybook MCP discovery before making UI changes.
- Use list-all-documentation to find valid component IDs.
- Use get-documentation for each impacted component before using props or variants.
- Use get-storybook-story-instructions before creating or editing any story.

Visual Change Workflow (test first)

1. Story first: add or update a story that captures the intended visual/behavior change.
2. Red: add or update play/assertions so the story test fails for the current UI.
3. Green: implement the UI change to make the story test pass.
4. Refactor: clean up while keeping story tests green.

Verification Gates

- Run run-story-tests for impacted stories after each change.
- Re-run until all impacted story tests pass.
- Run a broad run-story-tests pass before final handoff when scope is wide or uncertain.
- Use preview-stories and share the returned preview URLs for visual review.

Quality Guardrails

- Do not invent component props, variants, or IDs. Use only documented APIs.
- If a required component or prop is not documented, report it instead of guessing.
- Do not report completion while story tests are failing.
