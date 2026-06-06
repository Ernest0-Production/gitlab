import { ActionPanel, Color, Action, Icon, List, getPreferenceValues } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getGitLabGQL, gitlab } from "../common";
import { dataToProject, Group, Milestone, Project } from "../gitlabapi";
import { getTextIcon, GitLabIcons, useImage } from "../icons";
import { getErrorMessage, getFirstChar, showErrorToast } from "../utils";
import { GitLabOpenInBrowserAction } from "./actions";
import { EpicList } from "./epics";
import { IssueList, IssueScope, IssueState } from "./issues";
import { MilestoneList } from "./milestones";
import { MRList, MRScope, MRState } from "./mr";
import { ProjectListItem } from "./project";

function groupIconUrl(group: Group): string | undefined {
  let result: string | undefined;
  // TODO check also namespace for icon
  if (group.avatar_url) {
    result = group.avatar_url;
  } else if (group.owner && group.owner.avatar_url) {
    result = group.owner.avatar_url;
  }
  return result;
}

function webUrl(group: Group, partial: string) {
  return getGitLabGQL().urlJoin(`groups/${group.full_path}/${partial}`);
}

export function GroupListItem(props: { group: Group; nameOnly?: boolean }) {
  const group = props.group;
  const { localFilepath: localImageFilepath } = useImage(groupIconUrl(group));
  return (
    <List.Item
      id={`${group.id}`}
      title={props.nameOnly === true ? group.name : group.full_name}
      icon={localImageFilepath || getTextIcon((group.name ? getFirstChar(group.name) : "?").toUpperCase())}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Show Group"
              shortcut={{ modifiers: ["cmd"], key: "n" }}
              target={<GroupList parentGroup={props.group} />}
              icon={{ source: Icon.Terminal, tintColor: Color.PrimaryText }}
            />
            <GitLabOpenInBrowserAction url={group.web_url} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Group ID" content={group.id} />
            <Action.CopyToClipboard title="Copy Group URL" content={group.web_url} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.Push
              title="Epics"
              shortcut={{ modifiers: ["cmd"], key: "e" }}
              icon={{ source: GitLabIcons.epic, tintColor: Color.PrimaryText }}
              target={<EpicList group={props.group} />}
            />
            <Action.Push
              title="Issues"
              shortcut={{ modifiers: ["cmd"], key: "i" }}
              icon={{ source: GitLabIcons.issue, tintColor: Color.PrimaryText }}
              target={<IssueList group={group} scope={IssueScope.all} state={IssueState.opened} />}
            />
            <Action.Push
              title="Merge Requests"
              shortcut={{ modifiers: ["cmd"], key: "m" }}
              icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
              target={<MRList group={group} scope={MRScope.all} state={MRState.opened} />}
            />
            <Action.Push
              title="Milestones"
              shortcut={{ modifiers: ["cmd"], key: "s" }}
              icon={{ source: GitLabIcons.milestone, tintColor: Color.PrimaryText }}
              target={<MilestoneList group={group} />}
            />
            <GitLabOpenInBrowserAction
              title="Wiki"
              icon={{ source: GitLabIcons.wiki, tintColor: Color.PrimaryText }}
              url={webUrl(props.group, "-/wikis")}
            />
            <GitLabOpenInBrowserAction
              title="Labels"
              icon={{ source: GitLabIcons.labels, tintColor: Color.PrimaryText }}
              url={webUrl(props.group, "-/labels")}
            />
            <GitLabOpenInBrowserAction
              title="Security & Compliance"
              icon={{ source: GitLabIcons.security, tintColor: Color.PrimaryText }}
              url={webUrl(props.group, "-/security/dashboard")}
            />
            <GitLabOpenInBrowserAction
              title="Settings"
              icon={{ source: GitLabIcons.settings, tintColor: Color.PrimaryText }}
              url={webUrl(props.group, "-/edit")}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export function GroupListEmptyView() {
  return <List.EmptyView title="No Groups or Projects" icon={{ source: "group.svg", tintColor: Color.PrimaryText }} />;
}

function flatListViewPreferences(): boolean {
  const prefs = getPreferenceValues();
  return (prefs.flatlist as boolean) || false;
}

export function GroupList(props: { parentGroup?: Group }) {
  const parentGroup = props.parentGroup;
  const parentGroupID = parentGroup ? parentGroup.id : 0;
  const topLevelOnly = !flatListViewPreferences();
  const { groupsinfo, error, isLoading } = useMyGroups({ parentGroupID: parentGroupID, top_level_only: topLevelOnly });

  if (error) {
    showErrorToast(error, "Cannot search Groups");
  }

  if (groupsinfo === undefined && error === undefined) {
    return <List isLoading={true} />;
  }

  const navtitle = parentGroup ? `Group ${parentGroup.full_path}` : undefined;
  return (
    <List searchBarPlaceholder="Filter Groups by Name..." isLoading={isLoading} navigationTitle={navtitle}>
      <List.Section title="Groups">
        {groupsinfo?.groups?.map((group) => (
          <GroupListItem key={group.id} group={group} nameOnly={topLevelOnly} />
        ))}
      </List.Section>
      <List.Section title="Projects">
        {groupsinfo?.projects?.map((project) => (
          <ProjectListItem key={project.id} project={project} nameOnly={topLevelOnly} />
        ))}
      </List.Section>
      <GroupListEmptyView />
    </List>
  );
}

export function useMyGroups(args?: { query?: string; parentGroupID?: number; top_level_only?: boolean }): {
  groupsinfo?: GroupInfo;
  error?: string;
  isLoading: boolean | undefined;
} {
  const query = args?.query;
  const parentGroupID = args?.parentGroupID;
  const topLevelOnly = args?.top_level_only === true;
  const { data, isLoading, error } = useCachedPromise(
    async (parentID: number | undefined, topLevelOnly: boolean): Promise<GroupInfo> => {
      const params: Record<string, string> = { min_access_level: "10" };
      if ((parentID === undefined || parentID <= 0) && topLevelOnly) {
        params.top_level_only = "true";
      }
      const subgroupFilter = parentID && parentID > 0 ? `/${parentID}/subgroups` : "";
      const groups = ((await gitlab.fetch(`groups${subgroupFilter}`, params, true)) as Group[]) || [];

      let projects: Project[] = [];
      if (parentID && parentID > 0) {
        const projectsdata = ((await gitlab.fetch(`groups/${parentID}/projects`, {
          search: query || "",
          min_access_level: "30",
        })) || []) as Parameters<typeof dataToProject>[0][];
        projects = projectsdata.map((raw) => dataToProject(raw));
      }
      return { groups, projects };
    },
    [parentGroupID, topLevelOnly],
    { onError: () => undefined },
  );
  return { groupsinfo: data, isLoading, error: error ? getErrorMessage(error) : undefined };
}

export interface GroupInfo {
  milestones?: Milestone[];
  groups: Group[];
  projects: Project[];
}
