import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useEffect, useMemo, useState } from "react";
import { useCache } from "../cache";
import { gitlab } from "../common";
import { MergeRequest, Project } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { daysInSeconds, getErrorMessage, hashRecord, showErrorToast } from "../utils";
import {
  MRScope,
  MRState,
  MRListItem,
  MRListDetailsToggleAction,
  mrSearchBarPlaceholder,
  getMRQuery,
  injectMRQueryNamedParameters,
  useMRListDetails,
} from "./mr";
import { mrStateFilterIcon } from "./mr_status";
import { MyProjectsDropdown, useMyProjects } from "./project";

/* eslint-disable @typescript-eslint/no-explicit-any */

function partitionMrsByAuthor(mrs: MergeRequest[], userId: number) {
  const createdByMe: MergeRequest[] = [];
  const other: MergeRequest[] = [];
  for (const m of mrs) {
    if (m.author?.id === userId) {
      createdByMe.push(m);
    } else {
      other.push(m);
    }
  }
  return { createdByMe, other };
}

function mergeRequestStateFilterSubmenu(mrState: MRState, onSelectState: (state: MRState) => void) {
  const stateFilters: { state: MRState; title: string }[] = [
    { state: MRState.opened, title: "Open" },
    { state: MRState.merged, title: "Merged" },
    { state: MRState.closed, title: "Closed" },
  ];

  return (
    <ActionPanel.Submenu title="Filter by" shortcut={{ modifiers: ["cmd"], key: "f" }} icon={Icon.Filter}>
      <ActionPanel.Section>
        <Action
          title="All"
          icon={mrStateFilterIcon(MRState.all, mrState === MRState.all)}
          autoFocus={mrState === MRState.all}
          onAction={() => onSelectState(MRState.all)}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        {stateFilters.map(({ state, title }) => (
          <Action
            key={state}
            title={title}
            icon={mrStateFilterIcon(state, mrState === state)}
            autoFocus={mrState === state}
            onAction={() => onSelectState(state)}
          />
        ))}
      </ActionPanel.Section>
    </ActionPanel.Submenu>
  );
}

function SearchMergeRequestsEmptyView(props: {
  mrState: MRState;
  onSelectState: (state: MRState) => void;
  isShowingDetail: boolean;
  onToggleListDetails: () => void;
}) {
  return (
    <List.EmptyView
      title="No Merge Requests"
      icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <MRListDetailsToggleAction isShowingDetail={props.isShowingDetail} onToggle={props.onToggleListDetails} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Filter">
            {mergeRequestStateFilterSubmenu(props.mrState, props.onSelectState)}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export function SearchMyMergeRequests() {
  const [projectId, setProjectId] = useState<string | undefined>();
  const { projects: myprojects, isLoading: projectsLoading, error: projectsError } = useMyProjects();
  const [mrState, setMrState] = useCachedState<MRState>("mr-search-state", MRState.opened);
  const scope = MRScope.all;
  const [search, setSearch] = useState<string>();
  const [userId, setUserId] = useState<number | undefined>();
  const { isShowingDetail, toggleListDetails } = useMRListDetails();

  const project = useMemo(() => myprojects?.find((p) => `${p.id}` === projectId), [myprojects, projectId]);

  useEffect(() => {
    gitlab.getMyself().then((u) => setUserId(u.id));
  }, []);

  useEffect(() => {
    if (!myprojects?.length || projectId) {
      return;
    }
    setProjectId(`${myprojects[0].id}`);
  }, [myprojects, projectId]);

  useEffect(() => {
    if (!projectsError) {
      return;
    }
    showErrorToast(getErrorMessage(projectsError), "Could not fetch Projects");
  }, [projectsError]);

  const params: Record<string, any> = { state: mrState, scope };
  const qd = getMRQuery(search);
  params.search = qd.query || "";
  injectMRQueryNamedParameters(params, qd, scope, false);
  injectMRQueryNamedParameters(params, qd, scope, true);
  const paramsHash = hashRecord(params);
  const { data, isLoading, error, performRefetch } = useCache<MergeRequest[] | undefined>(
    project ? `mymrssearch_${project.id}_${paramsHash}` : "mymrssearch_no_project",
    async (): Promise<MergeRequest[] | undefined> => {
      if (!project) {
        return undefined;
      }
      return await gitlab.getMergeRequests(params, project);
    },
    {
      deps: [project?.id, search, mrState],
      secondsToRefetch: 1,
      secondsToInvalid: daysInSeconds(7),
    },
  );

  useEffect(() => {
    if (!error) {
      return;
    }
    showErrorToast(getErrorMessage(error), "Could not fetch Merge Requests");
  }, [error]);

  const { createdByMe, other } = useMemo(() => {
    if (!data || userId === undefined) {
      return { createdByMe: [], other: [] };
    }
    return partitionMrsByAuthor(data, userId);
  }, [data, userId]);

  if (projectsLoading || isLoading === undefined) {
    return <List isLoading={true} searchBarPlaceholder={mrSearchBarPlaceholder} />;
  }

  if (!myprojects || myprojects.length === 0) {
    return (
      <List searchBarPlaceholder={mrSearchBarPlaceholder}>
        <List.EmptyView
          title="No Projects"
          description="You have no GitLab projects with membership."
          icon={{ source: GitLabIcons.project, tintColor: Color.PrimaryText }}
        />
      </List>
    );
  }

  if (!project) {
    return <List isLoading={true} searchBarPlaceholder={mrSearchBarPlaceholder} />;
  }

  const listFilterActions = (
    <ActionPanel>
      <ActionPanel.Section>
        <MRListDetailsToggleAction isShowingDetail={isShowingDetail} onToggle={toggleListDetails} />
      </ActionPanel.Section>
      <ActionPanel.Section title="Filter">{mergeRequestStateFilterSubmenu(mrState, setMrState)}</ActionPanel.Section>
    </ActionPanel>
  );

  const onProjectChange = (pro: Project | undefined) => {
    setProjectId(pro ? `${pro.id}` : undefined);
  };

  const renderMrs = (mrs: MergeRequest[]) =>
    mrs.map((m) => (
      <MRListItem
        key={m.id}
        mr={m}
        refreshData={performRefetch}
        showCIStatus={true}
        isShowingDetail={isShowingDetail}
        onToggleListDetails={toggleListDetails}
        filterAction={mergeRequestStateFilterSubmenu(mrState, setMrState)}
      />
    ));

  return (
    <List
      isLoading={isLoading}
      searchText={search}
      onSearchTextChange={setSearch}
      searchBarPlaceholder={mrSearchBarPlaceholder}
      isShowingDetail={isShowingDetail}
      throttle
      searchBarAccessory={<MyProjectsDropdown includeAllItem={false} onChange={onProjectChange} storeValue />}
      actions={listFilterActions}
    >
      {createdByMe.length > 0 ? (
        <List.Section title="Created by me" subtitle={`${createdByMe.length}`}>
          {renderMrs(createdByMe)}
        </List.Section>
      ) : null}
      <List.Section title="Other" subtitle={`${other.length}`}>
        {renderMrs(other)}
      </List.Section>
      <SearchMergeRequestsEmptyView
        mrState={mrState}
        onSelectState={setMrState}
        isShowingDetail={isShowingDetail}
        onToggleListDetails={toggleListDetails}
      />
    </List>
  );
}
