import { useCallback, useEffect, useState } from 'react';
import { listRepoWebhookDeliveries, type RepoWebhookDeliverySummary } from '../api';

// Centralize repo webhook delivery fetching so multiple cards share one request. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
export const useRepoWebhookDeliveries = (repoId: string) => {
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deliveries, setDeliveries] = useState<RepoWebhookDeliverySummary[]>([]);

  const refresh = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await listRepoWebhookDeliveries(repoId, { limit: 50 });
      setDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : []);
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { deliveries, loading, loadFailed, refresh };
};
