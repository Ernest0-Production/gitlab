import { Action, ActionPanel, Image, List, open } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { User } from "../gitlabapi";
import { gitlab } from "../common";
import { useState } from "react";
import { getErrorMessage, showErrorToast } from "../utils";
import { GitLabOpenInBrowserAction } from "./actions";

export function UserList() {
  const [searchText, setSearchText] = useState<string>();
  const { users, error, isLoading } = useSearch(searchText);

  if (error) {
    showErrorToast(error, "Cannot search Merge Requests");
  }

  return (
    <List searchBarPlaceholder="Filter Users by name..." onSearchTextChange={setSearchText} isLoading={isLoading}>
      {users?.map((user) => (
        <UserListItem key={user.id} user={user} />
      ))}
    </List>
  );
}

export function UserListItem(props: { user: User }) {
  const user = props.user;
  return (
    <List.Item
      id={user.id.toString()}
      title={user.name}
      subtitle={user.username}
      icon={{ source: user.avatar_url, mask: Image.Mask.Circle }}
      actions={
        <ActionPanel>
          <GitLabOpenInBrowserAction url={user.web_url} />
          <Action.CopyToClipboard title="Copy User ID" content={user.id} />
          <Action.CopyToClipboard title="Copy Username" content={user.username} />
          <Action.CopyToClipboard title="Copy Name" content={user.name} />
        </ActionPanel>
      }
    />
  );
}

export function useSearch(query: string | undefined): {
  users?: User[];
  error?: string;
  isLoading: boolean;
} {
  const { data, error, isLoading } = usePromise(
    (searchQuery: string) => gitlab.getUsers({ searchText: searchQuery, searchIn: "title" }),
    [query ?? ""],
    // The error is surfaced via `error` and toasted by the caller in render.
    { onError: () => undefined },
  );
  return { users: data, error: error ? getErrorMessage(error) : undefined, isLoading };
}

export function userIcon(user: User): Image.ImageLike {
  return { source: user.avatar_url, mask: Image.Mask.Circle };
}

export function userTagOnAction(user: User): (() => void) | undefined {
  if (!user.web_url) {
    return undefined;
  }
  return () => open(user.web_url);
}
