# Task Plan: Mintlify docs refactor
{/* Define the goal and phases for the Mintlify docs refactor. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

## Session Metadata
- **Session Hash:** mintlify-docs-20260301
- **Created:** 2026-03-01

## Goal
Refactor documentation for Mintlify with a clear structure, accurate content, improved readability, and updated file-context-planning docs so everything renders correctly.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [ ] Understand user intent
- [ ] Identify constraints and requirements
- [ ] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [ ] Decide Mintlify information architecture and navigation
- [ ] Identify docs that need reformatting or content fixes
- [ ] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [ ] Refactor docs content and structure for Mintlify
- [ ] Update file-context-planning documentation for Mintlify rendering
- [ ] Add Mintlify-specific presentation enhancements (MDX, callouts, etc.)
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Verify docs structure is consistent and readable
- [ ] Check for broken references or invalid formatting
- [ ] Record validation results in progress.md
- **Status:** complete

### Phase 5: Delivery
- [ ] Review output and update changelog
- [ ] Summarize changes for user
- **Status:** complete

## Key Questions
1. What is the current docs structure and format (legacy site vs Mintlify vs custom)?
2. What Mintlify config file and navigation structure should be added or updated?
3. Which file-context-planning docs render poorly and need MDX adjustments?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Add `docs/docs.json` with Mintlify navigation groups + OpenAPI endpoints group | Align docs with Mintlify navigation and preserve endpoint visibility via auto-generated pages. |
| Keep existing docs under `docs/en/` and add a new landing page at `docs/index.md` | Avoid breaking existing links while providing a Mintlify-friendly entry point. |
| Replace legacy OpenAPI MDX components with endpoint maps + OpenAPI group | Ensure Mintlify renders API docs without losing endpoint coverage. |
| Convert HTML comments to MDX-safe comments where needed | Prevent Mintlify MDX parser errors and keep traceability comments intact. |

## Errors Encountered
{/* Log command parsing error while appending findings. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| zsh parse error near `}` when appending findings with backticks in printf | 1 | Retry append using a here-doc with single-quoted EOF to avoid shell interpolation. |
| Mintlify dev failed with "Unexpected character =" due to raw `<=` token in markdown | 1 | Wrap the `<=` token in inline code to avoid MDX tag parsing. |
{/* Wrap raw < in inline code to avoid MDX parsing. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Mintlify dev failed with `Unexpected character <` due to raw `<<repo-folder>>` markers | 1 | Wrap the markers in inline code to avoid MDX tag parsing. |
{/* Wrap <skill> marker in inline code to avoid MDX parsing. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Mintlify dev failed with `Expected a closing tag for <skill>` due to raw `<skill>` marker | 1 | Wrap the marker in inline code to avoid MDX tag parsing. |
{/* Wrap <void> in inline code to avoid MDX parsing. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Mintlify dev failed with `Expected a closing tag for <void>` due to raw `Promise<void>` type text | 1 | Wrap the generic types in inline code to avoid MDX tag parsing. |
{/* Add supported theme value to satisfy docs.json validation. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Mintlify dev failed with invalid docs.json theme discriminator | 1 | Added a supported `"theme": "mint"` value in `docs/docs.json`. |
{/* Align docs.json with v2 schema (colors + navigation object). docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Mintlify dev failed with missing `colors` and invalid `navigation` type in docs.json | 1 | Added `colors.primary` and wrapped `navigation` under `{ "groups": [...] }`. |
{/* Remove OpenAPI auto-generation to avoid missing local spec file. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| Mintlify dev failed because `api/openapi.json` was missing | 1 | Replaced the auto-generated OpenAPI group with a manual OpenAPI Spec page that links to `/api/openapi.json`. |
{/* Log shell expansion error when appending findings. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
| zsh command substitution error when appending findings with backticks | 1 | Re-appended using a single-quoted heredoc to avoid shell expansion. |

## Notes
- Update phase status as work progresses.
- Re-read this plan before major decisions.
- Log errors and avoid repeating failed actions.
