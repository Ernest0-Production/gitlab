import { Action, ActionPanel, Color, Icon, Image, List } from "@raycast/api";
import { GitLabIcons } from "../../icons";
import { capitalizeFirstLetter, formatDate } from "../../utils";
import { GitLabOpenInBrowserAction } from "../actions";
import { getCIJobStatusIcon } from "../jobs";
import { Commit } from "./types";
import { useCommitStatus } from "./utils";

export function CommitListItem(props: { commit: Commit; projectID: number }) {
  const commit = props.commit;
  const projectID = props.projectID;
  const { commitStatus: status } = useCommitStatus(projectID, commit.id);
  const icon: Image.ImageLike = status?.author?.avatar_url
    ? { source: status.author.avatar_url, mask: Image.Mask.Circle }
    : { source: GitLabIcons.commit, tintColor: Color.Green };
  const statusIcon: Image.ImageLike | undefined = status?.status
    ? getCIJobStatusIcon(status.status, status.allow_failure)
    : undefined;

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
        { icon: statusIcon, tooltip: status?.status ? `Status: ${capitalizeFirstLetter(status.status)}` : undefined },
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <GitLabOpenInBrowserAction url={commit.web_url} />
            <ActionPanel.Submenu title="Copy" icon={Icon.Clipboard} shortcut={{ modifiers: ["cmd"], key: "c" }}>
              <Action.CopyToClipboard
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
