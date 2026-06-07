import { ActionPanel, List, Color } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { Branch, Project } from "../gitlabapi";
import { gitlab } from "../common";
import { GitLabIcons } from "../icons";
import { CreateMRAction, ShowBranchCommitsAction } from "./branch_actions";
import { GitLabOpenInBrowserAction } from "./actions";
import { useCommitStatus } from "./commits/utils";
import { getCIJobStatusIcon, getMRPipelineStatusTooltip } from "./jobs";
import { getErrorMessage, showErrorToast } from "../utils";

export function BranchListItem(props: { branch: Branch; project: Project }) {
  const states = [];
  if (props.branch.default) {
    states.push("[default]");
  }
  if (props.branch.protected) {
    states.push("[protected]");
  }
  const { commitStatus } = useCommitStatus(props.project.id, props.branch?.commit?.id);

  return (
    <List.Item
      id={props.branch.id}
      title={props.branch.name}
      subtitle={states.join(" ")}
      icon={{
        value:
          props.branch.merged === true
            ? { source: GitLabIcons.merged, tintColor: Color.Purple }
            : { source: GitLabIcons.mropen, tintColor: Color.Green },
        tooltip: `Status: ${props.branch.merged === true ? "Merged" : "Open"}`,
      }}
      accessories={[
        {
          icon: commitStatus ? getCIJobStatusIcon(commitStatus.status, commitStatus.allow_failure) : undefined,
          tooltip: commitStatus?.status ? getMRPipelineStatusTooltip(commitStatus.status) : undefined,
        },
      ]}
      actions={
        <ActionPanel>
          <ShowBranchCommitsAction projectID={props.project.id} branch={props.branch} />
          <CreateMRAction project={props.project} branch={props.branch} />
          <GitLabOpenInBrowserAction url={props.branch.web_url} />
        </ActionPanel>
      }
    />
  );
}

export function BranchList(props: { project: Project; navigationTitle?: string }) {
  const [query, setQuery] = useState<string>("");
  const { branches, isLoading } = useSearch(query, props.project);
  return (
    <List isLoading={isLoading} onSearchTextChange={setQuery} throttle={true} navigationTitle={props.navigationTitle}>
      <List.Section title="Branches">
        {branches?.map((branch, index) => (
          <BranchListItem key={index} branch={branch} project={props.project} />
        ))}
      </List.Section>
    </List>
  );
}

export function useSearch(
  query: string | undefined,
  project: Project,
): {
  branches: Branch[];
  error?: string;
  isLoading: boolean;
} {
  const { data, error, isLoading } = usePromise(
    async (searchQuery: string, projectId: number): Promise<Branch[]> => {
      return (await gitlab.fetch(`projects/${projectId}/repository/branches`, { search: searchQuery })) || [];
    },
    [query ?? "", project.id]
  );
  return { branches: data ?? [], error: error?.message, isLoading };
}
