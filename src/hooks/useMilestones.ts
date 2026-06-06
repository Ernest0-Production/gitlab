import { usePromise, useCachedPromise } from "@raycast/utils";
import { Group, Milestone } from "../gitlabapi";
import { gitlab } from "../common";
import { getErrorMessage } from "../utils";

export function useMilestones(groupId?: number): {
  milestoneInfo?: Milestone[];
  errorMilestoneInfo?: string;
  isLoadingMilestoneInfo: boolean;
} {
  const { data: groups } = useCachedPromise(() => gitlab.getGroups(), [], { onError: () => undefined });

  const { data, error, isLoading } = usePromise(
    async (id: number, groupList: Group[]): Promise<Milestone[]> => {
      const group = groupList.find((candidate) => candidate.id === id);
      return group ? await gitlab.getGroupMilestones(group) : [];
    },
    [groupId ?? 0, groups ?? []],
    // Errors are surfaced via `errorMilestoneInfo`; the caller owns the toast.
    { execute: !!groupId && groupId > 0 && !!groups, onError: () => undefined },
  );

  return {
    milestoneInfo: data,
    errorMilestoneInfo: error ? getErrorMessage(error) : undefined,
    isLoadingMilestoneInfo: isLoading,
  };
}
