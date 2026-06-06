import { Action, ActionPanel, Color, Icon, Image, List } from "@raycast/api";
import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../common";
import { Epic, Group, searchData } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { capitalizeFirstLetter, formatDateTime, getErrorMessage, showErrorToast } from "../utils";
import { GitLabOpenInBrowserAction } from "./actions";
import { CreateEpicTodoAction } from "./epic_actions";

function getIcon(state: string): Image {
  if (state == "opened") {
    return { source: GitLabIcons.epic, tintColor: Color.Green };
  } else {
    return { source: GitLabIcons.epic, tintColor: Color.Purple };
  }
}

function getEpicGroupName(epic: Epic): string | undefined {
  const f: string | undefined = epic?.references?.full;
  if (!f) {
    return;
  }
  const i = f.lastIndexOf("&");
  if (i > 0) {
    return f.substring(0, i);
  }
}

function ActionToggleGroupName(props: { show?: boolean; callback?: (newValue: boolean) => void }) {
  if (!props.callback) {
    return null;
  }
  return (
    <Action
      title={"Toggle Group Name"}
      icon={props.show === true ? Icon.EyeDisabled : Icon.Eye}
      shortcut={{ modifiers: ["opt"], key: "d" }}
      onAction={() => {
        if (props.callback) {
          props.callback(!props.show);
        }
      }}
    />
  );
}

export function EpicListItem(props: {
  epic: Epic;
  displayGroup?: boolean;
  onChangeDisplayGroup?: (newValue?: boolean) => void;
}) {
  const epic = props.epic;
  const icon = getIcon(epic.state as string);
  const groupName = getEpicGroupName(epic);
  return (
    <List.Item
      id={epic.id.toString()}
      title={epic.title}
      subtitle={`&${epic.iid}`}
      accessories={[
        { text: props.displayGroup === true ? groupName : undefined },
        {
          text: epic.upvotes ? `${epic.upvotes}` : undefined,
          icon: epic.upvotes ? "👍" : undefined,
          tooltip: epic.upvotes ? `Upvotes: ${epic.upvotes}` : undefined,
        },
        {
          text: epic.downvotes ? `${epic.downvotes}` : undefined,
          icon: epic.downvotes ? "👎" : undefined,
          tooltip: epic.downvotes ? `Downvotes: ${epic.downvotes}` : undefined,
        },
        ...(epic.updated_at
          ? [{ date: new Date(epic.updated_at), tooltip: `Updated: ${formatDateTime(epic.updated_at)}` }]
          : []),
        {
          icon: epic.author ? { source: epic.author.avatar_url || "", mask: Image.Mask.Circle } : undefined,
          tooltip: epic.author?.name,
        },
      ]}
      icon={{ value: icon, tooltip: epic.state ? `Status: ${capitalizeFirstLetter(epic.state)}` : "" }}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <GitLabOpenInBrowserAction url={epic.web_url} />
            <CreateEpicTodoAction epic={epic} shortcut={{ modifiers: ["cmd"], key: "t" }} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.CopyToClipboard title="Copy Epic ID" content={epic.id} />
            <ActionToggleGroupName show={props.displayGroup} callback={props.onChangeDisplayGroup} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export function EpicList(props: { group: Group }) {
  const [searchText, setSearchText] = useState<string>();
  const { data, error, isLoading } = useCachedPromise(
    async (groupID: number): Promise<Epic[]> => {
      return (await gitlab.fetch(`groups/${groupID}/epics`, { min_access_level: "30", state: "opened" }, true)) || [];
    },
    [props.group.id],
    { onError: () => undefined },
  );

  if (error) {
    showErrorToast(getErrorMessage(error), "Cannot search Epics");
  }

  const epics: Epic[] = searchData<Epic>(data ?? [], { search: searchText || "", keys: ["title"], limit: 50 });
  const navTitle = `Epics ${props.group.full_path}`;
  return (
    <List
      searchBarPlaceholder="Filter Epics by name..."
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
      navigationTitle={navTitle}
    >
      <List.Section
        title={data ? `Recent Epics ${epics.length}` : undefined}
        subtitle={data ? `${epics.length}` : undefined}
      >
        {epics.map((epic) => (
          <EpicListItem key={epic.id} epic={epic} />
        ))}
      </List.Section>
    </List>
  );
}
