# Task Plan: Dynamic models by credential
{/* Translate remaining Chinese content to English for docs/en consistency. docsentrans20260121 */}
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. b8fucnmey62u0muyn7i0 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** b8fucnmey62u0muyn7i0
- **Created:** 2026-01-21

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
In frontend configuration screens (credentials / repo review / bot credentials), dynamically display and allow selecting available models based on the user-provided LLM credentials (query in real time when supported, otherwise fall back to a built-in list) to avoid hardcoding models.{/* Define dynamic model discovery goal for LLM credentials. b8fucnmey62u0muyn7i0 */}
Fix the “Available models” picker so clicking a model applies it to the active form field as intended.{/* Add bugfix goal for model picker click behavior. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Complete

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
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete
{/* Plan implementation details for dynamic model listing. b8fucnmey62u0muyn7i0 */}

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
- **Status:** complete
{/* Implement backend model listing APIs + frontend model preview/picker. b8fucnmey62u0muyn7i0 */}

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

### Phase 6: Model Picker Bugfix
{/* WHAT: Diagnose and fix the model picker click behavior in the available models list. WHY: Restores intended UX for model selection. */}
- [x] Reproduce and locate the click handler wiring
- [x] Fix model selection to update form state
- [x] Verify UI behavior and log tests
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Where is the mapping between "credentials" and the (code/claude/gemini) executors implemented today?
2. Which frontend forms need to display the "available models" list (which pages/components correspond to account credentials, repo review, and bot credentials respectively)?
3. Does the backend already have a unified LLM provider abstraction/SDK that we can reuse for auth and calls to query model lists?
4. Do providers have a "list models" API (OpenAI / Anthropic / Google Gemini); if it fails/unavailable, how should we fall back and cache?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Provide a unified backend API to list available models (by credential/provider) first | Reusable across multiple frontend surfaces and avoids exposing keys to the frontend, matching the security boundary |
| Query in real time when the provider supports it; otherwise fall back to a built-in model list | Meets the "no hardcoding" priority while ensuring availability |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| Duplicate function implementation (getModelCredentialsRaw) | 1 | Removed duplicate method and kept a single implementation |
| RepoDetailPage test could not find a Robots tab | 1 | Adjusted the test to open the robot modal from the "New robot" button instead of a non-existent tab |
| RepoDetailPage test could not find the "View models" button | 1 | Used a case-insensitive regex to match the accessible name that includes the icon text |
| RepoDetailPage test could not associate the Model label with its input | 1 | Forwarded Form.Item input props through the custom picker field to preserve the input id |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition
