// Extend Request auth typing to cover session and PAT tokens. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
import type { AuthContext } from '../modules/auth/authContext';

// Express Request/User type augmentation:
// - `backend/src/middlewares/auth.ts` populates `req.user` / `req.auth` after successful auth.
// - Allows `backend/src/routes/*` to safely access auth state in TypeScript (e.g. `requireAdmin`, `users/me`).
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      displayName?: string;
      roles: string[];
    }

    interface Request {
      user?: User;
      auth?: AuthContext;
      rawBody?: Buffer;
    }
  }
}
