# Task Group Page UI Cleanup & Modernization

## Goal
Clean up and modernize the task group chat page (`/#/task-groups/:id`) to achieve a simpler, more harmonious visual style.

## Key Issues
1. **Color disharmony** – Tags and Git workspace use hardcoded colors that clash with the monochrome design system
2. **Task card layout** – Meta grid too information-dense; Git workspace summary card uses blue highlights that look out of place
3. **Right-side log panel** – Misaligned content, inconsistent colors and icons
4. **Git workspace panel** – Blue gradients and colored elements clash with neutral B&W theme
5. **Composer input** – Repo/Worker selectors shown unnecessarily in the footer; should be cleaner

## Phases

### Phase 1 – Task card cleanup (in_progress)
- Simplify meta grid to a cleaner inline layout
- Harmonize status/event tag colors to match monochrome theme  
- Reduce visual noise in card actions

### Phase 2 – Git workspace summary modernization (pending)
- Replace blue gradients with neutral monochrome styles
- Update stat cards and pills to use design tokens
- Dark mode compatibility

### Phase 3 – Log panel alignment (pending)
- Improve spacing, alignment, and typography in the right panel

### Phase 4 – Composer cleanup (pending)
- Remove repo/worker selectors from composer footer inline display
- Simplify footer layout

### Phase 5 – Color token harmonization (pending)
- Update event/status tag colors for subtle monochrome palette
- Ensure dark mode compatibility throughout
