# Findings & Decisions: Improve preview highlight selector fallbacks
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. previewhighlightselector20260204 */}
<!-- Capture selector fallback findings for preview highlight updates. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->

## Session Metadata
- **Session Hash:** previewhighlightselector20260204
- **Created:** 2026-02-04

## Requirements
{/* Captured from user request */}
<!-- Track follow-up matcher requirements for selector updates. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
- Improve hookcode-preview-highlight behavior when some elements cannot be targeted.
- Add fallback element selection strategies (for example, querySelectorAll-based selection).
- Sync changes in `shared/preview-bridge.js` and update related skill documentation.
- Add additional matching rules (text/attribute-style selectors) and describe them clearly in the skill introduction.
- Prefer bubble placement on top/bottom with edge detection so tooltips do not clip off-screen.
- Auto-navigate preview URLs based on highlight target URLs, with a lock toggle to keep the current page.

## Research Findings
{/* Key discoveries during exploration */}
- `shared/preview-bridge.js` currently uses `document.querySelector(selector)` and returns `selector_not_found` when null.
- Highlight commands are delivered to the preview bridge via the SSE pipeline described in the skill docs.
- Frontend tests run with Vitest + JSDOM, which can execute `shared/preview-bridge.js` in a DOM-like environment for selector fallback tests.

## Technical Decisions
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add layered selector fallbacks (querySelectorAll visibility pick, simple id/class lookup, open shadow-root scan) in the bridge. | Improves element resolution without changing API inputs. |
| Use Vitest + JSDOM to eval the bridge script for selector fallback tests. | Provides DOM coverage without introducing a new test runner. |
| Add text/attribute matcher rules (text:, attr:, data:, aria:, role:, testid:, loose attr syntax). | Extends highlight targeting without changing the API surface. |
| Prefer vertical bubble placement with edge-aware flipping. | Prevents tooltips from rendering off-screen near the viewport edges. |
| Auto-navigate preview URLs based on `targetUrl` with a lock toggle. | Aligns highlights to the intended route while preserving user control. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `shared/preview-bridge.js`
- `.codex/skills/hookcode-preview-highlight/SKILL.md`
- `.codex/skills/hookcode-preview-highlight/references/highlight-protocol.md`
- `frontend/vitest.config.ts`

## Visual/Browser Findings
- None.

- New requirement: enhance targetUrl support with more complex route matching rules (beyond direct string match), impacting preview auto-navigation behavior and docs/tests.
- Current preview auto-navigation compares normalized URLs by origin+pathname+hash after dropping token query param; enhance this matcher to handle complex route rules for targetUrl.
- Current skill/protocol docs describe targetUrl as a plain URL/path; need to extend docs/examples for new matching rules once defined.
- Backend DTO currently validates targetUrl as a plain string (max 500); expanding route matching should stay string-based unless we update validation and API docs.
- CLI help and agent prompt mention targetUrl but not advanced matching; these docs need extension to describe new route match rules.
- Skill and protocol docs currently describe targetUrl as a plain URL/path; update sections in SKILL.md and highlight-protocol.md to document new wildcard/param/OR matching rules.
- Changelog already contains an entry for previewhighlightselector20260204; updated wording should mention advanced targetUrl route matching.
