# HookCode Frontend Guidelines

- All Comment should be in English.
- Usually you do not need to run the `dev` command in `package.json`.
- The frontend supports light/dark themes (via `data-theme` and CSS variables in `styles.css`); new pages/components must work in both themes.
- When adapting colors, consider the accent color. The accent color is configurable in settings; the UI should adapt to different accent colors.
- The frontend must support i18n. All newly added user-facing text must be internationalized.
- Prefer a componentized approach: split features into separate components and avoid overloading a single file.
- The layout must support both wide-screen desktop browsers and mobile browsers.
- Back navigation:
  - Do not add page-level "Back" buttons/links inside page content. All "go back" actions for full pages must be implemented as the header back icon (left of the title) in `frontend/src/App.tsx`.
  - When possible, the header back icon should return to the previous in-app location (prefer `window.history.back()` for hash routes) so users can go back to where they came from (e.g. task list -> repo detail -> back).
  - When there is no safe in-app history (e.g. the page is opened directly), the back icon must fall back to a stable route (e.g. `#/tasks` or `#/repos`).
  - If a page needs an explicit referrer for deep-linking (e.g. "back to task detail" from repo config), encode it via query params (e.g. `#/repos/:id?from=task&taskId=...`) and handle it in `frontend/src/App.tsx`.
