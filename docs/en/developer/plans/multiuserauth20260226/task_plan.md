# Task Plan: Multi-user roles, repo control, registration, invites
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. multiuserauth20260226 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** multiuserauth20260226
- **Created:** 2026-02-26

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Implement end-to-end multi-user RBAC with repo membership, invite-based onboarding, and email-backed registration so repo access, management, and task controls are enforced across backend and frontend.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
{/* Track post-review fixes as a follow-on phase. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
Phase 6 (Review Fixes)

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [ ] Define RBAC data model (user roles, repo members, invitations)
- [ ] Define email verification + registration flow
- [ ] Define permission gates per API (repos/tasks/automation)
- [ ] Plan frontend UI changes (register, verify, repo members)
- [ ] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
{/* Mark implementation tasks complete after RBAC/registration/invite rollout. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- [x] Update Prisma schema + migrations
- [x] Implement RBAC services + controller guards
- [x] Implement registration + email verification + invite flow
- [x] Add repo member management endpoints
- [x] Update frontend types + pages for RBAC and invites
- [x] Add/adjust tests
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
{/* Mark test phase complete after backend suite passes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- [x] Verify RBAC matrix for repo/task APIs
- [x] Verify registration + email flow (mocked)
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
{/* Close delivery phase after changelog + summary. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- [x] Update changelog entry with plan link
- [x] Review output files + doc updates
- [x] Deliver summary + next steps
- **Status:** complete

### Phase 6: Review Fixes
{/* Apply review feedback for auth-disabled mode, role validation, and register conflict responses. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- [x] Fix auth-disabled repo access regression
- [x] Validate member/invite roles at controller boundaries
- [x] Map duplicate registration to 409
- [x] Re-run full test suite
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Use SMTP for email sending with env configuration and mock transport in tests.
2. Enforce email verification before login only when `AUTH_REGISTER_REQUIRE_EMAIL_VERIFY=true`.

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Use a repo-member table with explicit roles (owner/maintainer/member) | Keeps access control local and enforceable without depending on Git provider. |
| Invite flow stored server-side with token + status | Allows email-based onboarding and audit trail. |
| SMTP-based mailer with env config + test mock | Minimal dependency, configurable for self-hosted installs. |
| Keep email verification toggle via existing `AUTH_REGISTER_REQUIRE_EMAIL_VERIFY` | Aligns with existing config flags and avoids breaking deployments. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
{/* Log command failures to avoid repeating lookup mistakes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
| `rg frontend/src/i18n/zh-CN.ts` failed (file not found) | 1 | List `frontend/src/i18n` to locate the actual locale files. |
| `apply_patch` failed to match the empty error row | 1 | Re-open the error table section and patch with the exact context lines. |
{/* Track apply_patch context mismatch when updating findings. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
| `apply_patch` failed to update findings.md (context mismatch) | 1 | Append the findings entry directly with `cat >>` to avoid context mismatches. |
{/* Track missing swagger file lookup and follow-up patch failure. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
| `cat backend/src/modules/repositories/dto/repository.swagger.ts` failed (file not found) | 1 | Use `rg` to locate the actual Swagger DTO file. |
| `apply_patch` failed to append the swagger lookup error row (context mismatch) | 1 | Re-open the error table and patch with exact context lines. |
{/* Track failed repoReadOnly insertion attempt. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
| `apply_patch` failed to insert repoReadOnly helpers in RepoDetailPage | 1 | Locate the exact lines with `rg`/`sed` and re-apply the patch with correct context. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition