# Findings - Refactor TaskGroup Preview UI

## Current State Analysis

### UI/UX Observations
- Mimics a traditional browser window with decorative dots (close, minimize, zoom) which are non-functional.
- Header is vertically tall, containing multiple rows:
  1. Title + Status
  2. Browser Toolbar (Nav buttons + Address bar + Actions)
  3. Instance Tabs (for multi-instance)
- Styling uses a "flat neutral chrome" approach but feels a bit busy due to multiple nested borders and shadow layers.
- Address bar has a security/globe prefix and a separate focus ring within the toolbar.
- Draggable divider uses a simple handle.

### Technical Details
- **Component**: `TaskGroupChatPage.tsx`
- **Styles**: `frontend/src/styles/preview-shell.css`
- **State Management**: Uses `previewState`, `activePreviewName`, `previewIframeOverrideSrc`, etc.
- **Features**: Back/Forward/Reload navigation, address bar input, multi-instance tabs, logs modal, share/copy links, auto-navigation lock.

## Proposed Improvements
1. **Vertical Space Optimization**:
   - Remove decorative window dots.
   - Merge Title/Status with the toolbar or tabs.
   - Aim for a more compact header (max 2 rows, or 1 row if possible).
2. **Visual Modernization**:
   - Use more subtle borders and backgrounds.
   - Refine the address bar to feel less like a "browser in a browser" and more like an integrated preview control.
   - Update tabs to use a more modern look (e.g., segmented controls or pill-style tabs without extra rows).
3. **Functional Refinement**:
   - Improve the "Running" status visibility.
   - Ensure "Preview" title is clear but doesn't dominate.

## Related Files
- `frontend/src/pages/TaskGroupChatPage.tsx`: Main logic and TSX.
- `frontend/src/styles/preview-shell.css`: Layout and shell styling.
- `frontend/src/styles/preview-logs.css`: Logs and diagnostics styling.
- `frontend/src/i18n/en/index.json`: Localized strings (if new ones are needed).