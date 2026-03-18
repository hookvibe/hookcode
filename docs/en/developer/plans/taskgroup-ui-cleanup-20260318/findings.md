# Findings

## Current Issues
- Git workspace summary uses `rgba(61, 92, 255, ...)` blue gradients – clashes with B&W tokens
- Git workspace stat cards use hardcoded blue/slate colors instead of CSS variables
- Status tags use various Ant Design preset colors (blue, gold, green, red, purple)
- Event tags use diverse colors (cyan, geekblue, volcano, purple, blue)
- Composer footer shows repo/robot/worker selectors inline – adds visual clutter
- Task card meta grid renders 7+ fields in a responsive grid which feels dense

## Key Files
- `frontend/src/styles/task-git-workspace.css` – Git workspace styling (blue gradients)
- `frontend/src/styles/task-group-workspace.css` – Task card and log panel styling
- `frontend/src/styles/composer.css` – Composer box styling
- `frontend/src/utils/task/status.tsx` – Status/event tag color mapping
- `frontend/src/components/tasks/TaskGitWorkspaceSummaryCard.tsx` – Git summary card
- `frontend/src/components/taskGroupWorkspace/TaskGroupTaskCard.tsx` – Task card
- `frontend/src/components/taskGroupWorkspace/TaskGroupComposer.tsx` – Composer
- `frontend/src/components/taskGroupWorkspace/TaskGroupLogPanel.tsx` – Log panel
