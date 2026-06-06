import { Action, ActionPanel, List, Color, Detail, Image, Icon } from "@raycast/api";
import { gql } from "@apollo/client";
import { useState } from "react";
import { usePromise } from "@raycast/utils";
import { getGitLabGQL, gitlab } from "../common";
import { Group, Issue, Project } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import {
  capitalizeFirstLetter,
  formatDate,
  formatDateTime,
  getErrorMessage,
  optimizeMarkdownText,
  Query,
  showErrorToast,
  tokenizeQueryText,
} from "../utils";
import { IssueItemActions } from "./issue_actions";
import { GitLabOpenInBrowserAction } from "./actions";
import { userIcon, userTagOnAction } from "./users";

/* eslint-disable @typescript-eslint/no-explicit-any */

export enum IssueScope {
  created_by_me = "created_by_me",
  assigned_to_me = "assigned_to_me",
  all = "all",
}

export enum IssueState {
  all = "all",
  opened = "opened",
  closed = "closed",
}

const GET_ISSUE_DETAIL = gql`
  query GetIssueDetail($id: IssueID!) {
    issue(id: $id) {
      description
      webUrl
    }
  }
`;

export function IssueListEmptyView() {
  return <List.EmptyView title="No Issues" icon={{ source: "issues.svg", tintColor: Color.PrimaryText }} />;
}

export function IssueDetailFetch(props: { project: Project; issueId: number }) {
  const { issue, isLoading, error } = useIssue(props.project.id, props.issueId);
  if (error) {
    showErrorToast(error, "Could not fetch Issue Details");
  }
  if (isLoading || !issue) {
    return <Detail isLoading={isLoading} />;
  } else {
    return <IssueDetail issue={issue} />;
  }
}

interface IssueDetailData {
  description: string;
  projectWebUrl?: string;
}

function stateColor(state: string): Color.ColorLike {
  return state === "closed" ? "red" : "green";
}

export function IssueDetail(props: { issue: Issue }) {
  const issue = props.issue;
  const { issueDetail, error, isLoading } = useDetail(props.issue.id);
  if (error) {
    showErrorToast(error, "Could not get Issue Details");
  }

  const desc = (issueDetail?.description ? issueDetail.description : props.issue.description) || "";

  const lines: string[] = [];
  if (issue) {
    lines.push(`# ${issue.title}`);
    lines.push(optimizeMarkdownText(desc, issueDetail?.projectWebUrl));
  }
  const md = lines.join("  \n");

  return (
    <Detail
      markdown={md}
      isLoading={isLoading}
      navigationTitle={`${props.issue.reference_full}`}
      actions={
        <ActionPanel>
          <GitLabOpenInBrowserAction url={props.issue.web_url} />
          <IssueItemActions issue={props.issue} />
          <Action.CopyToClipboard title="Copy Issue Description" content={issue.description} />
        </ActionPanel>
      }
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.TagList title="Status">
            <Detail.Metadata.TagList.Item text={capitalizeFirstLetter(issue.state)} color={stateColor(issue.state)} />
          </Detail.Metadata.TagList>
          {issue.author && (
            <Detail.Metadata.TagList title="Author">
              <Detail.Metadata.TagList.Item
                key={issue.id}
                text={issue.author.name}
                icon={userIcon(issue.author)}
                onAction={userTagOnAction(issue.author)}
              />
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.TagList title="Assignee">
            {issue.assignees.length > 0 ? (
              issue.assignees.map((assignee) => (
                <Detail.Metadata.TagList.Item
                  key={assignee.id}
                  text={assignee.name}
                  icon={userIcon(assignee)}
                  onAction={userTagOnAction(assignee)}
                />
              ))
            ) : (
              <Detail.Metadata.TagList.Item text="-" />
            )}
          </Detail.Metadata.TagList>
          {issue.created_at && <Detail.Metadata.Label title="Created" text={formatDate(issue.created_at)} />}
          {issue.updated_at && <Detail.Metadata.Label title="Updated" text={formatDate(issue.updated_at)} />}
          {issue.milestone && <Detail.Metadata.Label title="Milestone" text={issue.milestone.title} />}
          {issue.labels.length > 0 && (
            <Detail.Metadata.TagList title="Labels">
              {issue.labels?.map((label) => (
                <Detail.Metadata.TagList.Item key={label.id} text={label.name || "?"} color={label.color} />
              ))}
            </Detail.Metadata.TagList>
          )}
        </Detail.Metadata>
      }
    />
  );
}

function useDetail(issueID: number): {
  issueDetail?: IssueDetailData;
  error?: string;
  isLoading: boolean;
} {
  const { data, error, isLoading } = usePromise(
    async (issueId: number): Promise<IssueDetailData> => {
      const data = await getGitLabGQL().client.query({
        query: GET_ISSUE_DETAIL,
        variables: { id: `gid://gitlab/Issue/${issueId}` },
      });
      const desc = data.data.issue.description || "<no description>";
      const webUrl = (data.data.issue.webUrl as string) || "";
      let projectWebUrl: string | undefined;
      const index = webUrl.indexOf("/-/");
      if (index > 1) {
        projectWebUrl = webUrl.substring(0, index);
      }
      return { description: desc, projectWebUrl };
    },
    [issueID],
    // The error is surfaced via `error` and toasted by the caller in render.
    { execute: issueID > 0, onError: () => undefined },
  );

  return { issueDetail: data, error: error ? getErrorMessage(error) : undefined, isLoading };
}

export function IssueListItem(props: { issue: Issue; refreshData: () => void }) {
  const issue = props.issue;
  const tintColor = issue.state === "opened" ? Color.Green : Color.Red;
  return (
    <List.Item
      id={issue.id.toString()}
      title={issue.title}
      subtitle={"#" + issue.iid}
      icon={{
        value: {
          source: GitLabIcons.issue,
          tintColor: tintColor,
        },
        tooltip: `Status: ${capitalizeFirstLetter(issue.state)}`,
      }}
      accessories={[
        {
          text: issue.merge_requests_count > 0 ? `${issue.merge_requests_count}` : undefined,
          icon: issue.merge_requests_count > 0 ? { source: "branch.png", tintColor: Color.PrimaryText } : undefined,
        },
        {
          icon: issue.user_notes_count && issue.user_notes_count > 0 ? Icon.SpeechBubble : undefined,
          text: issue.user_notes_count && issue.user_notes_count > 0 ? issue.user_notes_count.toString() : undefined,
          tooltip:
            issue.user_notes_count && issue.user_notes_count > 0
              ? `Number of Comments ${issue.user_notes_count}`
              : undefined,
        },
        {
          tag: issue.milestone ? issue.milestone.title : "",
          tooltip: issue.milestone ? `Milestone: ${issue.milestone.title}` : undefined,
        },
        { date: new Date(issue.updated_at), tooltip: `Updated: ${formatDateTime(issue.updated_at)}` },
        {
          icon: { source: issue.author?.avatar_url || "", mask: Image.Mask.Circle },
          tooltip: issue.author ? `Author: ${issue.author?.name}` : undefined,
        },
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Show Details"
              target={<IssueDetail issue={issue} />}
              icon={{ source: GitLabIcons.show_details, tintColor: Color.PrimaryText }}
            />
            <GitLabOpenInBrowserAction url={issue.web_url} shortcut={{ modifiers: ["cmd"], key: "enter" }} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <IssueItemActions issue={issue} onDataChange={props.refreshData} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

interface IssueListProps {
  scope: IssueScope;
  state?: IssueState;
  project?: Project;
  group?: Group;
  searchBarAccessory?:
    | React.ReactElement<List.Dropdown.Props, string | React.JSXElementConstructor<any>>
    | null
    | undefined;
}

function navTitle(project?: Project, group?: Group): string | undefined {
  if (group) {
    return `Group Issues ${group.full_path}`;
  }
  if (project) {
    return `${project.name_with_namespace}`;
  }
  return undefined;
}

export function IssueList({
  scope = IssueScope.created_by_me,
  state = IssueState.all,
  project = undefined,
  group = undefined,
}: IssueListProps) {
  const [searchText, setSearchText] = useState<string>();
  const [searchState, setSearchState] = useState<IssueState>(state);
  const { issues, error, isLoading, refresh } = useSearch(searchText, scope, searchState, project, group);

  if (error) {
    showErrorToast(error, "Cannot search Issue");
  }

  const title = scope === IssueScope.assigned_to_me ? "Your Issues" : "Created Recently";

  return (
    <List
      searchBarPlaceholder="Search Issues by Name..."
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
      searchBarAccessory={
        <List.Dropdown
          tooltip="State"
          onChange={(newValue) => {
            for (const value of Object.values(IssueState)) {
              if (value === newValue) {
                setSearchState(IssueState[newValue]);
                refresh();
                return;
              }
            }
          }}
        >
          <List.Dropdown.Item title="Opened" value={IssueState.opened} />
          <List.Dropdown.Item title="Closed" value={IssueState.closed} />
          <List.Dropdown.Item title="All" value={IssueState.all} />
        </List.Dropdown>
      }
      navigationTitle={navTitle(project, group)}
    >
      <List.Section title={title} subtitle={issues?.length.toString() || ""}>
        {issues?.map((issue) => (
          <IssueListItem key={issue.id} issue={issue} refreshData={refresh} />
        ))}
      </List.Section>
      <IssueListEmptyView />
    </List>
  );
}

export function getIssueQuery(query: string | undefined) {
  return tokenizeQueryText(query, ["label", "author", "milestone", "assignee", "state"]);
}

function isValidIssueState(texts: string[] | undefined) {
  if (!texts) {
    return false;
  }
  for (const v of texts) {
    if (![IssueState.closed.valueOf(), IssueState.opened.valueOf(), IssueState.all.valueOf()].includes(v)) {
      return false;
    }
  }
  return true;
}

export function injectQueryNamedParameters(
  requestParams: Record<string, any>,
  query: Query,
  scope: IssueScope,
  isNegative: boolean,
) {
  const namedParams = isNegative ? query.negativeNamed : query.named;
  for (const extraParam of Object.keys(namedParams)) {
    const extraParamVal = namedParams[extraParam];
    const prefixed = (text: string): string => {
      return isNegative ? `not[${text}]` : text;
    };
    if (extraParamVal) {
      switch (extraParam) {
        case "label":
          {
            requestParams[prefixed("labels")] = extraParamVal.join(",");
          }
          break;
        case "author":
          {
            if (scope === IssueScope.all) {
              requestParams[prefixed("author_username")] = extraParamVal.join(",");
            }
          }
          break;
        case "milestone":
          {
            requestParams[prefixed("milestone")] = extraParamVal.join(",");
          }
          break;
        case "assignee":
          {
            if (scope === IssueScope.all) {
              requestParams[prefixed("assignee_username")] = extraParamVal.join(",");
            }
          }
          break;
        case "state": {
          console.log(extraParamVal);
          if (isValidIssueState(extraParamVal)) {
            requestParams[prefixed("state")] = extraParamVal.join(",");
          }
        }
      }
    }
  }
}

export function useSearch(
  query: string | undefined,
  scope: IssueScope,
  state: IssueState,
  project?: Project,
  group?: Group,
): {
  issues?: Issue[];
  error?: string;
  isLoading: boolean;
  refresh: () => void;
} {
  const { data, error, isLoading, revalidate } = usePromise(
    async (
      queryText: string,
      issueScope: IssueScope,
      issueState: IssueState,
      project?: Project,
      group?: Group,
    ): Promise<Issue[]> => {
      const parsedQuery = getIssueQuery(queryText);
      const requestParams: Record<string, any> = {
        state: issueState,
        scope: issueScope,
        search: parsedQuery.query || "",
        in: "title",
      };
      injectQueryNamedParameters(requestParams, parsedQuery, issueScope, false);
      injectQueryNamedParameters(requestParams, parsedQuery, issueScope, true);
      return group ? gitlab.getGroupIssues(requestParams, group.id) : gitlab.getIssues(requestParams, project);
    },
    [query ?? "", scope, state, project, group],
    // The error is surfaced via `error` and toasted by the caller in render.
    { onError: () => undefined },
  );

  return { issues: data, error: error ? getErrorMessage(error) : undefined, isLoading, refresh: revalidate };
}

export function useIssue(
  projectID: number,
  issueID: number,
): {
  issue?: Issue;
  error?: string;
  isLoading: boolean;
} {
  const { data, error, isLoading } = usePromise(
    (projectId: number, issueId: number) => gitlab.getIssue(projectId, issueId, {}),
    [projectID, issueID],
    // The error is surfaced via `error` and toasted by the caller in render.
    { onError: () => undefined },
  );

  return { issue: data, error: error ? getErrorMessage(error) : undefined, isLoading };
}
