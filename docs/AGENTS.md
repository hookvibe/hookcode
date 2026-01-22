# rule

<!-- Update docs navigation rules to use Docusaurus sidebars instead of docs.json. docs/en/developer/plans/dsim8xybp9oa18nz1gfq/task_plan.md dsim8xybp9oa18nz1gfq -->

- When adding a new Markdown file (excluding AGENTS.md and _template.md), you must add a link to the new file under docs and keep the file navigation up to date.

- When editing docs, keep `docs/sidebars.ts` (Docusaurus navigation) and the relevant section index pages (e.g. `docs/en/user-docs/index.md`) up to date so content is discoverable.
- User-facing docs pages under `docs/en/user-docs/`, `docs/en/api-reference/`, and `docs/en/change-log/` should include frontmatter with a `title` (developer plan logs under `docs/en/developer/plans/*` are exempt).
- When a code change affects user-facing behavior, update the corresponding docs in the same session (do not leave docs stale).
- When a doc change is tied to a code change, include a traceability comment near the code that references the session plan path (see repo-root `AGENTS.md`).
