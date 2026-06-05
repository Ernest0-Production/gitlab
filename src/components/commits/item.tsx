import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { GitLabIcons } from "../../icons";
import { copyShortcut, formatDate } from "../../utils";
import { GitLabOpenInBrowserAction } from "../actions";
import { Commit } from "./types";

export function CommitListItem(props: { commit: Commit }) {
  const commit = props.commit;

  return (
    <List.Item
      key={commit.id}
      title={commit.title}
      icon={{ value: { source: GitLabIcons.commit, tintColor: Color.SecondaryText }, tooltip: commit.author_name }}
      accessories={[
        {
          text: formatDate(commit.created_at),
          tooltip: `Created: ${new Date(commit.created_at).toLocaleString()}`,
        },
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <GitLabOpenInBrowserAction url={commit.web_url} />
            <ActionPanel.Submenu title="Copy" icon={Icon.Clipboard} shortcut={copyShortcut}>
              <Action.CopyToClipboard
                // eslint-disable-next-line @raycast/prefer-title-case
                title="SHA"
                content={commit.id}
                icon={{ source: Icon.Hashtag, tintColor: Color.PrimaryText }}
              />
              <Action.CopyToClipboard
                title="URL"
                content={commit.web_url}
                icon={{ source: Icon.Link, tintColor: Color.PrimaryText }}
              />
            </ActionPanel.Submenu>
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
