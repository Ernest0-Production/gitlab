import { usePromise } from "@raycast/utils";
import { User, Label, Milestone, Branch, TemplateSummary } from "../gitlabapi";
import { gitlab } from "../common";
import { getErrorMessage } from "../utils";

export interface ProjectInfoMR {
  members: User[];
  labels: Label[];
  milestones: Milestone[];
  branches: Branch[];
  mergeRequestTemplates: TemplateSummary[];
}

export function useProjectMR(query?: string): {
  projectinfo?: ProjectInfoMR;
  errorProjectInfo?: string;
  isLoadingProjectInfo: boolean;
} {
  const proid = parseInt(query || "0");
  const { data, error, isLoading } = usePromise(
    async (projectId: number): Promise<ProjectInfoMR> => {
      const members = await gitlab.getProjectMember(projectId);
      const labels = await gitlab.getProjectLabels(projectId);
      const milestones = await gitlab.getProjectMilestones(projectId);
      const branches = ((await gitlab.fetch(`projects/${projectId}/repository/branches`, {}, true)) as Branch[]) || [];
      const mergeRequestTemplates = await gitlab.getProjectMergeRequestTemplates(projectId);
      return { members, labels, milestones, branches, mergeRequestTemplates };
    },
    [proid],
    {
      execute: proid > 0,
    },
  );

  return {
    projectinfo: data,
    errorProjectInfo: error ? getErrorMessage(error) : undefined,
    isLoadingProjectInfo: isLoading,
  };
}
