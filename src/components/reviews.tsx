import { ActionPanel, Color, List } from "@raycast/api";
import { MergeRequest, Project } from "../gitlabapi";
import { gitlab } from "../common";
import { getErrorMessage, showErrorToast } from "../utils";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { MyProjectsDropdown } from "./project";
import { MRListDetailsToggleAction, MRListMetadataToggleAction, MRListItem, useMRListDetails } from "./mr";
import { GitLabIcons } from "../icons";

function ReviewListEmptyView() {
  return <List.EmptyView title="No Reviews" icon={{ source: GitLabIcons.review, tintColor: Color.PrimaryText }} />;
}

export function ReviewList() {
  const [project, setProject] = useState<Project>();
  const { mrs, error, isLoading, performRefetch } = useMyReviews(project);
  const { isShowingDetail, toggleListDetails } = useMRListDetails();

  if (error) {
    showErrorToast(error, "Cannot search Reviews");
  }

  if (isLoading && mrs === undefined) {
    return <List isLoading={true} searchBarPlaceholder="" />;
  }

  return (
    <List
      searchBarPlaceholder="Filter Reviews by name..."
      isLoading={isLoading}
      searchBarAccessory={<MyProjectsDropdown onChange={setProject} storeValue={true} />}
      isShowingDetail={isShowingDetail}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <MRListDetailsToggleAction isShowingDetail={isShowingDetail} onToggle={toggleListDetails} />
            <MRListMetadataToggleAction isShowingDetail={isShowingDetail} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      {mrs?.map((mr) => (
        <MRListItem
          key={mr.id}
          mr={mr}
          refreshData={performRefetch}
          isShowingDetail={isShowingDetail}
          onToggleListDetails={toggleListDetails}
        />
      ))}
      <ReviewListEmptyView />
    </List>
  );
}

export function useMyReviews(
  project?: Project | undefined,
  labels: string[] | undefined = undefined,
): {
  mrs: MergeRequest[] | undefined;
  isLoading: boolean;
  error: string | undefined;
  performRefetch: () => void;
} {
  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (labelFilter: string[] | undefined): Promise<MergeRequest[] | undefined> => {
      const user = await gitlab.getMyself();
      return gitlab.getMergeRequests({
        state: "opened",
        reviewer_id: user.id,
        in: "title",
        scope: "all",
        ...(labelFilter && { labels: labelFilter }),
      });
    },
    [labels],
    { onError: () => undefined },
  );
  const mrs = project ? data?.filter((mr) => mr.project_id === project.id) : data;
  return { mrs, isLoading, error: error ? getErrorMessage(error) : undefined, performRefetch: revalidate };
}
