import { usePromise } from "@raycast/utils";
import { User, Label, Milestone } from "../gitlabapi";
import { gitlab } from "../common";
import { getErrorMessage } from "../utils";

export interface ProjectInfo {
  members: User[];
  labels: Label[];
  milestones: Milestone[];
}

export function useProject(query?: string): {
  projectinfo?: ProjectInfo;
  errorProjectInfo?: string;
  isLoadingProjectInfo: boolean;
} {
  const proid = parseInt(query || "0");
  const { data, error, isLoading } = usePromise(
    async (projectId: number): Promise<ProjectInfo> => {
      const members = await gitlab.getProjectMember(projectId);
      const labels = await gitlab.getProjectLabels(projectId);
      const milestones = await gitlab.getProjectMilestones(projectId);
      return { members, labels, milestones };
    },
    [proid],
    // Errors are surfaced via `errorProjectInfo`; the caller owns the toast.
    { execute: proid > 0, onError: () => undefined },
  );

  return {
    projectinfo: data,
    errorProjectInfo: error ? getErrorMessage(error) : undefined,
    isLoadingProjectInfo: isLoading,
  };
}
