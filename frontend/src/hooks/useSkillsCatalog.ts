import { useCallback, useState } from 'react';
import { fetchSkills } from '../api';
import type { SkillSummary } from '../api';

type SkillsCatalogState = {
  skills: SkillSummary[];
  loading: boolean;
  error: unknown | null;
  refresh: () => Promise<void>;
};

export const useSkillsCatalog = (): SkillsCatalogState => {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  const refresh = useCallback(async () => {
    // Load the combined skills catalog for shared selection panels. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    setLoading(true);
    try {
      const data = await fetchSkills();
      setSkills([...data.builtIn, ...data.extra]);
      setError(null);
    } catch (err) {
      console.error(err);
      setSkills([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { skills, loading, error, refresh };
};
