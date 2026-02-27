import { createHash, randomBytes } from 'crypto';

export const generateToken = (bytes = 32): string => randomBytes(bytes).toString('hex');

export const hashToken = (token: string): string => {
  // Store only a hash to avoid persisting raw tokens. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  return createHash('sha256').update(token).digest('hex');
};
