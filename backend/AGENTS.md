# Backend guidelines

This directory contains the hookcode backend server code.

- After changing the backend, update the corresponding pages in `../frontend` that consume the affected APIs to keep frontend and backend consistent.
- After changes, run `pnpm build` to ensure the build succeeds.
- New backend features must support i18n so that the frontend can localize user-facing output.

## `promptBuilder` guidelines

- Prompts must be built via templates: use the robot/trigger template after variables have been interpolated and concatenated.
