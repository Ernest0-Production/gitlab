import { Action, ActionPanel, Color, List } from "@raycast/api";
import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import urljoin from "url-join";
import { getCIRefreshInterval, gitlab } from "../../common";
import { Project } from "../../gitlabapi";
import { GitLabIcons } from "../../icons";
import { getErrorMessage, showErrorToast } from "../../utils";
import { GitLabOpenInBrowserAction } from "../actions";
import { Event } from "../event";
import { PipelineJobsListByCommit } from "../jobs";
import { MyProjectsDropdown } from "../project";
import { CommitListItem } from "./item";
import { RefreshCommitsAction } from "./actions";
import { usePaginatedMergeRequestCommits, usePaginatedProjectCommits } from "./data";
import useInterval from "use-interval";

function EventCommitListItem(props: { event: Event; onRefresh?: () => void }) {
  const event = props.event;
  const commit = event.push_data?.commit_to;
  const ref = event.push_data?.ref;
  const title = event.push_data?.commit_title || "no title";
  const { data: project } = useCachedPromise((projectID: number) => gitlab.getProject(projectID), [event.project_id], {
    onError: () => undefined,
  });
  const webAction = (): React.ReactNode | undefined => {
    if (project) {
      const proUrl = project.web_url;
      if (proUrl && commit) {
        const url = urljoin(proUrl, `-/commit/${commit}`);
        return <GitLabOpenInBrowserAction url={url} />;
      }
    }
    return undefined;
  };

  const action = (): React.ReactNode | undefined | null => {
    if (project && commit) {
      return (
        <Action.Push
          title="Open Pipeline"
          icon={{ source: GitLabIcons.ci, tintColor: Color.PrimaryText }}
          target={<PipelineJobsListByCommit project={project} sha={commit} />}
        />
      );
    }
    return null;
  };

  return (
    <List.Item
      title={title}
      subtitle={ref || commit}
      accessories={[{ text: project?.name_with_namespace }]}
      icon={{ source: GitLabIcons.commit, tintColor: Color.SecondaryText }}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {action()}
            {webAction()}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <RefreshCommitsAction onRefreshJobs={props.onRefresh} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function RecentCommitsListEmptyView() {
  return <List.EmptyView title="No Commits" icon={{ source: GitLabIcons.commit, tintColor: Color.PrimaryText }} />;
}

export function RecentCommitsList() {
  const [project, setProject] = useState<Project>();
  const { data, error, isLoading, revalidate } = useCachedPromise(
    async (): Promise<Event[]> => {
      const events = (await gitlab.fetch("events", { action: "pushed" })) as Event[];
      return events.filter((event) => event.action_name === "pushed to" || event.action_name === "pushed new");
    },
    [],
    { onError: () => undefined },
  );
  useInterval(() => {
    revalidate();
  }, getCIRefreshInterval());
  if (error) {
    showErrorToast(getErrorMessage(error), "Could not fetch Events");
  }
  if (isLoading && data === undefined) {
    return <List isLoading={true} searchBarPlaceholder="" />;
  }
  const commits = project ? data?.filter((event) => event.project_id === project.id) : data;

  return (
    <List isLoading={isLoading} searchBarAccessory={<MyProjectsDropdown onChange={setProject} />}>
      {commits?.map((event) => (
        <EventCommitListItem event={event} key={`${event.id}`} onRefresh={revalidate} />
      ))}
      <RecentCommitsListEmptyView />
    </List>
  );
}

export type { Commit, CommitStatus } from "./types";

function ProjectCommitListEmptyView() {
  return <List.EmptyView title="No Commits" icon={{ source: GitLabIcons.commit, tintColor: Color.PrimaryText }} />;
}

export function MRCommitList(props: { projectID: number; mrIID: number; navigationTitle?: string }) {
  const { projectID, mrIID } = props;
  const cacheKey = `mr_commits_${projectID}_${mrIID}`;
  const { commits, isLoading, error, pagination } = usePaginatedMergeRequestCommits({
    cacheKey,
    projectID,
    mrIID,
  });

  if (error) {
    showErrorToast(error, "Could not fetch Merge Request commits");
  }

  return (
    <List isLoading={isLoading} pagination={pagination} navigationTitle={props.navigationTitle}>
      {(commits ?? []).map((commit) => (
        <CommitListItem key={commit.id} commit={commit} />
      ))}
      <ProjectCommitListEmptyView />
    </List>
  );
}

export function ProjectCommitList(props: { projectID: number; refName?: string; navigationTitle?: string }) {
  const projectID = props.projectID;
  const refName = props.refName;
  const cacheKey = refName ? `project_commits_${projectID}_${refName}` : `project_commits_${projectID}`;
  const { commits, isLoading, error, pagination } = usePaginatedProjectCommits({
    cacheKey,
    projectID,
    refName,
  });

  if (error) {
    showErrorToast(error, "Could not fetch commits from Project");
  }

  return (
    <List isLoading={isLoading} pagination={pagination} navigationTitle={props.navigationTitle}>
      {(commits ?? []).map((commit) => (
        <CommitListItem key={commit.id} commit={commit} />
      ))}
      <ProjectCommitListEmptyView />
    </List>
  );
}
