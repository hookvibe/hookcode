import { api, getCached, getApiErrorMessage, invalidateGetCache, invalidateTaskCaches } from './client';
import type { ApprovalRequest, ApprovalRequestStatus } from './types';

type ApprovalMutationPayload = {
  note?: string;
};

export const fetchApprovals = async (options?: {
  repoId?: string;
  taskId?: string;
  status?: ApprovalRequestStatus;
  limit?: number;
}): Promise<{ approvals: ApprovalRequest[] }> => {
  return getCached<{ approvals: ApprovalRequest[] }>('/approvals', { params: options, cacheTtlMs: 5000 });
};

export const fetchApproval = async (approvalId: string): Promise<ApprovalRequest> => {
  return getCached<ApprovalRequest>(`/approvals/${approvalId}`);
};

const invalidateApprovalCaches = () => {
  invalidateGetCache('/approvals');
  invalidateTaskCaches();
};

export const approveApprovalRequest = async (
  approvalId: string,
  options?: ApprovalMutationPayload
): Promise<ApprovalRequest> => {
  const { data } = await api.post<{ approval: ApprovalRequest }>(`/approvals/${approvalId}/approve`, {
    note: options?.note
  });
  invalidateApprovalCaches();
  return data.approval;
};

export const approveApprovalAlways = async (
  approvalId: string,
  options?: ApprovalMutationPayload
): Promise<ApprovalRequest> => {
  const { data } = await api.post<{ approval: ApprovalRequest }>(`/approvals/${approvalId}/approve-always`, {
    note: options?.note
  });
  invalidateApprovalCaches();
  return data.approval;
};

export const rejectApprovalRequest = async (
  approvalId: string,
  options?: ApprovalMutationPayload
): Promise<ApprovalRequest> => {
  const { data } = await api.post<{ approval: ApprovalRequest }>(`/approvals/${approvalId}/reject`, {
    note: options?.note
  });
  invalidateApprovalCaches();
  return data.approval;
};

export const requestApprovalChanges = async (
  approvalId: string,
  options?: ApprovalMutationPayload
): Promise<ApprovalRequest> => {
  const { data } = await api.post<{ approval: ApprovalRequest }>(`/approvals/${approvalId}/request-changes`, {
    note: options?.note
  });
  invalidateApprovalCaches();
  return data.approval;
};

export const getApprovalErrorMessage = (error: unknown): string => getApiErrorMessage(error);
