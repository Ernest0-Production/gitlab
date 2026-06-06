import { gql } from "@apollo/client";
import { ActionPanel, Color, List } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getGitLabGQL } from "../common";
import { Group, Project } from "../gitlabapi";
import { getErrorMessage, getIdFromGqlId, showErrorToast } from "../utils";
import { GitLabOpenInBrowserAction } from "./actions";

const GET_MILESTONES = gql`
  query GetProjectMilestones($fullPath: ID!) {
    project(fullPath: $fullPath) {
      milestones(sort: DUE_DATE_DESC) {
        nodes {
          id
          title
          dueDate
          state
          expired
          webPath
          stats {
            closedIssuesCount
            totalIssuesCount
          }
        }
      }
    }
  }
`;

const GET_GROUP_MILESTONES = gql`
  query GetGroupMilestones($fullPath: ID!) {
    group(fullPath: $fullPath) {
      milestones(includeDescendants: true) {
        nodes {
          id
          title
          dueDate
          state
          expired
          webPath
          stats {
            closedIssuesCount
            totalIssuesCount
          }
        }
      }
    }
  }
`;

interface MilestoneListEntry {
  id: number;
  title: string;
  dueDate?: string;
  dueDateTime?: number;
  state: string;
  expired?: boolean;
  webUrl: string;
  closedIssuesCount: number;
  totalIssuesCount: number;
}

interface GqlMilestoneNode {
  id: string;
  title: string;
  dueDate?: string;
  state: string;
  expired?: boolean;
  webPath: string;
  stats: { closedIssuesCount: number; totalIssuesCount: number };
}

function getColorByRatio(ratio: number): Color {
  const colors = [Color.Red, Color.Orange, Color.Yellow, Color.Blue, Color.Green];
  const colorIndex = Math.floor(ratio * (colors.length - 1));
  return colors[colorIndex];
}

export function MilestoneListItem(props: { milestone: MilestoneListEntry }) {
  const milestone = props.milestone;
  const issueCounter = `${milestone.closedIssuesCount}/${milestone.totalIssuesCount}`;
  const issueRatio =
    milestone.totalIssuesCount && milestone.totalIssuesCount > 0
      ? milestone.closedIssuesCount / milestone.totalIssuesCount
      : 0.0;
  const issuePercent = `${(issueRatio * 100).toFixed(0)}%`;
  let subtitle = "";
  if (milestone.dueDateTime) {
    subtitle = milestone.dueDate ?? "";
    if (milestone.expired && milestone.state !== "closed") {
      subtitle += ` ⚠️ ${milestone.expired ? " [expired]" : ""}`;
    }
  }
  const ratioColor = getColorByRatio(issueRatio);
  return (
    <List.Item
      id={`${milestone.id}`}
      title={milestone.title}
      subtitle={subtitle}
      accessories={[{ text: issueCounter }, { tag: { value: issuePercent, color: ratioColor } }]}
      actions={
        <ActionPanel>
          <GitLabOpenInBrowserAction url={milestone.webUrl} />
        </ActionPanel>
      }
    />
  );
}

export function MilestoneList(props: { project?: Project; group?: Group; navigationTitle?: string }) {
  const isGroup = !!props.group;
  let fullPath = props.project ? props.project.fullPath : "";
  if (fullPath.length <= 0) {
    fullPath = props.group ? props.group.full_path : "";
  }
  const { milestones, error, isLoading } = useSearch(fullPath, isGroup);
  if (error) {
    showErrorToast(error, "Cannot search Milestones");
  }
  const closeMilestones = milestones.filter((milestone) => milestone.state === "closed");
  const openMilestones = milestones
    .filter((milestone) => milestone.state !== "closed")
    .sort((a, b) => (a.dueDateTime || 0) - (b.dueDateTime || 0));

  return (
    <List isLoading={isLoading} navigationTitle={props.navigationTitle || "Milestones"}>
      <List.Section title="Open">
        {openMilestones?.map((milestone) => (
          <MilestoneListItem key={milestone.id} milestone={milestone} />
        ))}
      </List.Section>
      <List.Section title="Closed">
        {closeMilestones?.map((milestone) => (
          <MilestoneListItem key={milestone.id} milestone={milestone} />
        ))}
      </List.Section>
    </List>
  );
}

export function useSearch(
  projectFullPath: string,
  isGroup: boolean,
): {
  milestones: MilestoneListEntry[];
  error?: string;
  isLoading: boolean;
} {
  const { data, error, isLoading } = usePromise(
    async (fullPath: string, group: boolean): Promise<MilestoneListEntry[]> => {
      const gqlQuery = group ? GET_GROUP_MILESTONES : GET_MILESTONES;
      const data = await getGitLabGQL().client.query({ query: gqlQuery, variables: { fullPath } });
      const milestoneRoot = group ? data.data.group : data.data.project;
      return milestoneRoot.milestones.nodes.map(
        (node: GqlMilestoneNode): MilestoneListEntry => ({
          id: getIdFromGqlId(node.id),
          title: node.title,
          dueDate: node.dueDate,
          dueDateTime: node.dueDate ? new Date(node.dueDate).getTime() : undefined,
          state: node.state,
          expired: node.expired,
          webUrl: `${getGitLabGQL().url}/${node.webPath}`,
          closedIssuesCount: node.stats.closedIssuesCount,
          totalIssuesCount: node.stats.totalIssuesCount,
        }),
      );
    },
    [projectFullPath, isGroup],
    // The error is surfaced via `error` and toasted by the caller in render.
    { onError: () => undefined },
  );
  return { milestones: data ?? [], error: error ? getErrorMessage(error) : undefined, isLoading };
}
