import { isTruthy } from '../utils/env';

export const isTaskLogsEnabled = (): boolean => isTruthy(process.env.TASK_LOGS_ENABLED, false);
