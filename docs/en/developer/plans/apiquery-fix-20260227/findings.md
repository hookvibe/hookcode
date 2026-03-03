# Findings & Decisions: Fix missing NestJS decorators

{/* Link discoveries to code changes via this session hash. apiquery-fix-20260227 */}

## Session Metadata
- **Session Hash:** apiquery-fix-20260227
- **Created:** 2026-02-27

## Requirements
- Fix backend dev startup errors caused by missing `ApiQuery` and `Query` decorator references.
- Ensure TypeScript compilation and runtime module loading succeed for backend.

## Research Findings
- Current errors point to `backend/src/modules/tasks/task-groups.controller.ts` (missing `ApiQuery`) and `backend/src/modules/skills/skills.controller.ts` (missing `Query`).
- `task-groups.controller.ts` imports `Query` from `@nestjs/common` but omits `ApiQuery` from `@nestjs/swagger` while using the decorator.
- `skills.controller.ts` imports `ApiQuery` but not `Query`, despite using `@Query(...)` in the list handler.
- The failure occurs during module load, so the missing decorator is referenced at runtime, not only in type checking.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Import NestJS `Query` decorator from `@nestjs/common` in skills controller. | Align with standard NestJS controller decorator usage. |
| Import Swagger `ApiQuery` decorator from `@nestjs/swagger` in task groups controller. | `ApiQuery` is defined by Swagger package, not NestJS core. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Runtime ReferenceError for `ApiQuery` during backend module load. | Add missing import and ensure usage matches Swagger decorator signature. |
| TS2304 cannot find name `Query` in skills controller. | Add missing NestJS import. |

## Resources
- `backend/src/modules/tasks/task-groups.controller.ts`
- `backend/src/modules/skills/skills.controller.ts`

## Visual/Browser Findings
- None.