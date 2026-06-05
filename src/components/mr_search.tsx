import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCachedState } from "@raycast/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Project } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { getErrorMessage, hashRecord, showErrorToast } from "../utils";
import {
  MRScope,
  MRState,
  MRListItem,
  MRListDetailsToggleAction,
  MRListMetadataToggleAction,
  mrSearchBarPlaceholder,
  getMRQuery,
  injectMRQueryNamedParameters,
  useMRListDetails,
} from "./mr";
import { RefreshMergeRequestsAction } from "./mr_actions";
import { usePaginatedMergeRequests } from "./mr_data";
import { appendMROrderByParams, mergeRequestSortSubmenu, MR_DEFAULT_ORDER_BY, MRSearchOrderBy } from "./mr_sort";
import { mergeRequestScopeSubmenu } from "./mr_scope";
import { mrStateFilterIcon } from "./mr_status";
import { MyProjectsDropdown, useMyProjects } from "./project";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mergeRequestFilterSection(
  mrState: MRState,
  onSelectState: (state: MRState) => void,
  scope: MRScope,
  onSelectScope: (scope: MRScope) => void,
  orderBy: MRSearchOrderBy,
  onSelectOrderBy: (orderBy: MRSearchOrderBy) => void,
  onRefresh: () => void,
) {
  return (
    <>
      <ActionPanel.Section title="Filters">
        {mergeRequestScopeSubmenu(scope, onSelectScope)}
        {mergeRequestStateFilterSubmenu(mrState, onSelectState)}
        {mergeRequestSortSubmenu(orderBy, onSelectOrderBy)}
      </ActionPanel.Section>
      <ActionPanel.Section>
        <RefreshMergeRequestsAction onRefresh={onRefresh} />
      </ActionPanel.Section>
    </>
  );
}

function mergeRequestStateFilterSubmenu(mrState: MRState, onSelectState: (state: MRState) => void) {
  const stateFilters: { state: MRState; title: string }[] = [
    { state: MRState.opened, title: "Open" },
    { state: MRState.merged, title: "Merged" },
    { state: MRState.closed, title: "Closed" },
  ];

  return (
    <ActionPanel.Submenu title="Filter Status" icon={Icon.Filter}>
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
  scope: MRScope;
  onSelectScope: (scope: MRScope) => void;
  orderBy: MRSearchOrderBy;
  onSelectOrderBy: (orderBy: MRSearchOrderBy) => void;
  onRefresh: () => void;
  isShowingDetail: boolean;
  onToggleListDetails: () => void;
}) {
  return (
    <List.EmptyView
      title="No Merge Requests"
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <MRListDetailsToggleAction isShowingDetail={props.isShowingDetail} onToggle={props.onToggleListDetails} />
            <MRListMetadataToggleAction isShowingDetail={props.isShowingDetail} />
          </ActionPanel.Section>
          {mergeRequestFilterSection(
            props.mrState,
            props.onSelectState,
            props.scope,
            props.onSelectScope,
            props.orderBy,
            props.onSelectOrderBy,
            props.onRefresh,
          )}
        </ActionPanel>
      }
    />
  );
}

export function SearchMyMergeRequests() {
  const [projectId, setProjectId] = useCachedState<string | undefined>("mr-search-project-id", undefined);
  const { projects: myprojects, isLoading: projectsLoading, error: projectsError } = useMyProjects();
  const [mrState, setMrState] = useCachedState<MRState>("mr-search-state", MRState.opened);
  const [scope, setScope] = useCachedState<MRScope>("mr-search-scope", MRScope.all);
  const [orderBy, setOrderBy] = useCachedState<MRSearchOrderBy>("mr-search-order-by", MR_DEFAULT_ORDER_BY);
  const [search, setSearch] = useState<string>("");
  const { isShowingDetail, toggleListDetails } = useMRListDetails();

  const project = useMemo(() => myprojects?.find((p) => `${p.id}` === projectId), [myprojects, projectId]);

  useEffect(() => {
    if (!myprojects?.length || projectId !== undefined) {
      return;
    }
    setProjectId(`${myprojects[0].id}`);
  }, [myprojects, projectId, setProjectId]);

  useEffect(() => {
    if (!projectsError) {
      return;
    }
    showErrorToast(getErrorMessage(projectsError), "Could not fetch Projects");
  }, [projectsError]);

  const params = useMemo(() => {
    const requestParams: Record<string, any> = { state: mrState, scope };
    appendMROrderByParams(requestParams, orderBy);
    const qd = getMRQuery(search);
    requestParams.search = qd.query || "";
    injectMRQueryNamedParameters(requestParams, qd, scope, false);
    injectMRQueryNamedParameters(requestParams, qd, scope, true);
    return requestParams;
  }, [mrState, scope, orderBy, search]);
  const paramsHash = useMemo(() => hashRecord(params), [params]);
  const {
    mrs: data,
    isLoading,
    error,
    performRefetch,
    pagination,
  } = usePaginatedMergeRequests({
    cacheKey: `mymrssearch_${project?.id ?? "none"}_${paramsHash}`,
    buildParams: () => params,
    project,
    execute: !!project,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (!error) {
      return;
    }
    showErrorToast(getErrorMessage(error), "Could not fetch Merge Requests");
  }, [error]);

  const filterAction = useMemo(() => mergeRequestStateFilterSubmenu(mrState, setMrState), [mrState, setMrState]);
  const scopeAction = useMemo(() => mergeRequestScopeSubmenu(scope, setScope), [scope, setScope]);
  const sortAction = useMemo(() => mergeRequestSortSubmenu(orderBy, setOrderBy), [orderBy, setOrderBy]);
  const refreshAction = useMemo(() => <RefreshMergeRequestsAction onRefresh={performRefetch} />, [performRefetch]);
  const filterSection = useMemo(
    () => mergeRequestFilterSection(mrState, setMrState, scope, setScope, orderBy, setOrderBy, performRefetch),
    [mrState, setMrState, scope, setScope, orderBy, setOrderBy, performRefetch],
  );

  const listFilterActions = useMemo(
    () => (
      <ActionPanel>
        <ActionPanel.Section>
          <MRListDetailsToggleAction isShowingDetail={isShowingDetail} onToggle={toggleListDetails} />
          <MRListMetadataToggleAction isShowingDetail={isShowingDetail} />
        </ActionPanel.Section>
        {filterSection}
      </ActionPanel>
    ),
    [isShowingDetail, toggleListDetails, filterSection],
  );

  const onProjectChange = useCallback(
    (pro: Project | undefined) => {
      const nextId = pro ? `${pro.id}` : undefined;
      setProjectId((current) => (current === nextId ? current : nextId));
    },
    [setProjectId],
  );

  const searchBarAccessory = useMemo(
    () => (
      <MyProjectsDropdown
        projects={myprojects}
        value={projectId}
        includeAllItem={false}
        onChange={onProjectChange}
        storeValue
      />
    ),
    [myprojects, projectId, onProjectChange],
  );

  const hasProjects = !!myprojects && myprojects.length > 0;

  return (
    <List
      isLoading={projectsLoading || isLoading || (hasProjects && !project)}
      pagination={pagination}
      searchText={search}
      onSearchTextChange={setSearch}
      searchBarPlaceholder={mrSearchBarPlaceholder}
      isShowingDetail={isShowingDetail}
      throttle
      searchBarAccessory={searchBarAccessory}
      actions={listFilterActions}
    >
      {!projectsLoading && !hasProjects ? (
        <List.EmptyView
          title="No Projects"
          description="You have no GitLab projects with membership."
          icon={{ source: GitLabIcons.project, tintColor: Color.PrimaryText }}
        />
      ) : (
        <>
            {(data ?? []).map((m) => (
              <MRListItem
                key={m.id}
                mr={m}
                refreshData={performRefetch}
                showCIStatus={true}
                isShowingDetail={isShowingDetail}
                onToggleListDetails={toggleListDetails}
                filterAction={filterAction}
                scopeAction={scopeAction}
                sortAction={sortAction}
                refreshAction={refreshAction}
              />
            ))}
            <SearchMergeRequestsEmptyView
              mrState={mrState}
              onSelectState={setMrState}
              scope={scope}
              onSelectScope={setScope}
              orderBy={orderBy}
              onSelectOrderBy={setOrderBy}
              onRefresh={performRefetch}
              isShowingDetail={isShowingDetail}
              onToggleListDetails={toggleListDetails}
            />
        </>
      )}
    </List>
  );
}
