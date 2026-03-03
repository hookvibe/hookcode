# rule
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Align docs navigation rules with Mintlify docs.json. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

- When adding a new Markdown file (excluding AGENTS.md and _template.md), you must add a link to the new file under docs and keep the file navigation up to date.

- When editing docs, keep `docs/docs.json` (Mintlify navigation) and relevant section index pages (e.g. `docs/en/user-docs/index.md`) up to date so content is discoverable.
- Docs content is parsed as MDX by Mintlify, so use MDX-safe comments (`{/* ... */}`) instead of HTML comments.
- User-facing docs pages under `docs/en/user-docs/`, `docs/en/api-reference/`, and `docs/en/change-log/` should include frontmatter with a `title` (developer plan logs under `docs/en/developer/plans/*` are exempt).
- When a code change affects user-facing behavior, update the corresponding docs in the same session (do not leave docs stale).
- When a doc change is tied to a code change, include a traceability comment near the code that references the session plan path (see repo-root `AGENTS.md`).