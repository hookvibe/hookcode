import { useEffect, type RefObject } from 'react';

type InfiniteScrollOptions = {
  targetRef: RefObject<Element | null>;
  rootRef?: RefObject<Element | null>;
  enabled: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  threshold?: number;
};

// Trigger load-more callbacks when a sentinel enters view using IntersectionObserver. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
export const useInfiniteScroll = ({
  targetRef,
  rootRef,
  enabled,
  onLoadMore,
  rootMargin = '200px',
  threshold = 0
}: InfiniteScrollOptions): void => {
  useEffect(() => {
    if (!enabled) return;
    const target = targetRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { root: rootRef?.current ?? null, rootMargin, threshold }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, onLoadMore, rootMargin, rootRef, targetRef, threshold]);
};
