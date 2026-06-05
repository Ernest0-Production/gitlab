import { Action, ActionPanel, Color, List } from "@raycast/api";
import { useEffect, useState } from "react";
import urljoin from "url-join";
import { useCache } from "../../cache";
import { getCIRefreshInterval, gitlab } from "../../common";
import { Project } from "../../gitlabapi";
import { GitLabIcons } from "../../icons";
import { showErrorToast } from "../../utils";
import { GitLabOpenInBrowserAction } from "../actions";
import { Event } from "../event";
import { PipelineJobsListByCommit } from "../jobs";
import { MyProjectsDropdown } from "../project";
import { CommitListItem } from "./item";
import { RefreshCommitsAction } from "./actions";
import { usePaginatedMergeRequestCommits, usePaginatedProjectCommits } from "./data";
import useInterval from "use-interval";

function EventCommitListItem(props: { event: Event; onRefresh?: () => void }) {
  const e = props.event;
  const commit = e.push_data?.commit_to;
  const ref = e.push_data?.ref;
  const title = e.push_data?.commit_title || "no title";
  const { data: project } = useCache<Project | undefined>(
    `event_project_${e.project_id}`,
    async (): Promise<Project | undefined> => {
      const pro = await gitlab.getProject(e.project_id);
      return pro;
    },
    {
      deps: [e.project_id],
      secondsToRefetch: 15 * 60,
    },
  );
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
      icon={{ value: { source: GitLabIcons.commit, tintColor: Color.SecondaryText } }}
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
  const { data, error, isLoading, performRefetch } = useCache<Event[]>(
    "events_pushed",
    async (): Promise<Event[]> => {
      const events: Event[] = await gitlab.fetch("events", { action: "pushed" }).then((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return d.map((ev: any) => ev as Event);
      });
      const result = events.filter((e) => e.action_name === "pushed to" || e.action_name === "pushed new");
      return result;
    },
    {
      deps: [],
      secondsToRefetch: 5,
    },
  );
  useInterval(() => {
    performRefetch();
  }, getCIRefreshInterval());
  if (error) {
    showErrorToast(error, "Could not fetch Events");
  }
  if (isLoading === undefined) {
    return <List isLoading={true} searchBarPlaceholder="" />;
  }
  const commits = project ? data?.filter((e) => e.project_id === project.id) : data;

  return (
    <List isLoading={isLoading} searchBarAccessory={<MyProjectsDropdown onChange={setProject} />}>
      {commits?.map((e) => (
        <EventCommitListItem event={e} key={`${e.id}`} onRefresh={performRefetch} />
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

  useEffect(() => {
    if (!error) {
      return;
    }
    showErrorToast(error, "Could not fetch Merge Request commits");
  }, [error]);

  return (
    <List isLoading={isLoading} pagination={pagination} navigationTitle={props.navigationTitle}>
      {(commits ?? []).map((e) => (
        <CommitListItem key={e.id} commit={e} />
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

  useEffect(() => {
    if (!error) {
      return;
    }
    showErrorToast(error, "Could not fetch commits from Project");
  }, [error]);

  return (
    <List isLoading={isLoading} pagination={pagination} navigationTitle={props.navigationTitle}>
      {(commits ?? []).map((e) => (
        <CommitListItem key={e.id} commit={e} />
      ))}
      <ProjectCommitListEmptyView />
    </List>
  );
}
