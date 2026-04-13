type ProfileWithId = { id?: string | null };

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const pickStoredProfileById = <T extends ProfileWithId>(params: {
  profiles?: readonly T[] | null;
  requestedProfileId?: string | null;
  defaultProfileId?: string | null;
}): T | null => {
  // Keep explicit credential profile selections exact so deleted ids do not silently drift to another stored profile. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const profiles = Array.isArray(params.profiles) ? params.profiles : [];
  const requestedId = safeTrim(params.requestedProfileId);
  if (requestedId) {
    return profiles.find((profile) => safeTrim(profile?.id) === requestedId) ?? null;
  }

  const defaultId = safeTrim(params.defaultProfileId);
  return (
    (defaultId && profiles.find((profile) => safeTrim(profile?.id) === defaultId)) ||
    profiles.find((profile) => Boolean(profile && safeTrim(profile?.id))) ||
    null
  );
};

export const hasStoredProfileId = <T extends ProfileWithId>(
  profiles?: readonly T[] | null,
  requestedProfileId?: string | null
): boolean => {
  // Reuse exact id matching when validating persisted profile references before execution or save. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
  const requestedId = safeTrim(requestedProfileId);
  if (!requestedId) return false;
  return Array.isArray(profiles) && profiles.some((profile) => safeTrim(profile?.id) === requestedId);
};
