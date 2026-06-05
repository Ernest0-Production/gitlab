import { Action, ActionPanel, Color, Icon, Image, List } from "@raycast/api";
import { GitLabIcons } from "../../icons";
import { useUserAvatar } from "../../hooks";
import { copySecondaryShortcut, copyShortcut, formatDate } from "../../utils";
import { GitLabOpenInBrowserAction } from "../actions";
import { Commit } from "./types";

export function CommitListItem(props: { commit: Commit }) {
  const commit = props.commit;
  const { avatarUrl } = useUserAvatar(commit.author_email);

  const icon: Image.ImageLike = avatarUrl
    ? { source: avatarUrl, mask: Image.Mask.Circle }
    : { source: GitLabIcons.commit, tintColor: Color.SecondaryText };

  return (
    <List.Item
      key={commit.id}
      title={commit.title}
      icon={{ value: icon, tooltip: commit.author_name }}
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
            <Action.CopyToClipboard
              title="Copy URL"
              content={commit.web_url}
              shortcut={copyShortcut}
              icon={{ source: Icon.Link, tintColor: Color.PrimaryText }}
            />
            <Action.CopyToClipboard
              // eslint-disable-next-line @raycast/prefer-title-case
              title="Copy SHA"
              content={commit.id}
              shortcut={copySecondaryShortcut}
              icon={{ source: Icon.Hashtag, tintColor: Color.PrimaryText }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
