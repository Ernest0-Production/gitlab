import { Action, ActionPanel, Alert, Color, confirmAlert, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import React from "react";
import { gitlab } from "../common";
import { MergeRequest } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { getErrorMessage, showErrorToast } from "../utils";
import { ProjectCommitList } from "./commits/list";
import { findTodoForMR, useTodos } from "./todo/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function createNote(mr: MergeRequest, body: string): Promise<any> {
  return await gitlab.post(`projects/${mr.project_id}/merge_requests/${mr.iid}/notes`, { body: body });
}

export function CloseMRAction(props: { mr: MergeRequest; finished?: () => void }) {
  const mr = props.mr;
  async function handleAction() {
    if (
      !(await confirmAlert({
        title: "Close Merge Request?",
        message: `Close !${mr.iid} "${mr.title}"?`,
        primaryAction: { title: "Close", style: Alert.ActionStyle.Destructive },
      }))
    ) {
      return;
    }
    try {
      await createNote(mr, "/close");
      showToast(Toast.Style.Success, "Closed");
      if (props.finished) {
        props.finished();
      }
    } catch (error) {
      showErrorToast(getErrorMessage(error), "Failed to close Merge Request");
    }
  }
  return (
    <Action
      title="Close"
      icon={{ source: Icon.XMarkCircle, tintColor: Color.Red }}
      style={Action.Style.Destructive}
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
      onAction={handleAction}
    />
  );
}

export function ReopenMRAction(props: { mr: MergeRequest; finished?: () => void }) {
  const mr = props.mr;
  async function handleAction() {
    try {
      await createNote(mr, "/reopen");
      showToast(Toast.Style.Success, "Reopened");
      if (props.finished) {
        props.finished();
      }
    } catch (error) {
      showErrorToast(getErrorMessage(error), "Failed to reopen Merge Request");
    }
  }
  return <Action title="Reopen" icon={{ source: Icon.ExclamationMark }} onAction={handleAction} />;
}

export function RebaseMRAction(props: { mr: MergeRequest; shortcut?: Keyboard.Shortcut; finished?: () => void }) {
  const mr = props.mr;
  async function handleAction() {
    if (
      !(await confirmAlert({
        title: "Rebase Merge Request?",
        message: `Rebase !${mr.iid} "${mr.title}"?`,
        primaryAction: { title: "Rebase", style: Alert.ActionStyle.Destructive },
      }))
    ) {
      return;
    }
    try {
      await createNote(mr, "/rebase");
      showToast(Toast.Style.Success, "Rebased");
      props.finished?.();
    } catch (error) {
      showErrorToast(getErrorMessage(error), "Failed to rebase Merge Request");
    }
  }
  return (
    <Action
      title="Rebase"
      shortcut={props.shortcut}
      icon={{ source: GitLabIcons.rebase, tintColor: Color.PrimaryText }}
      onAction={handleAction}
    />
  );
}

export function MergeMRAction(props: {
  mr: MergeRequest;
  shortcut?: Keyboard.Shortcut;
  finished?: () => void;
}): React.ReactElement | null {
  const mr = props.mr;
  async function handleAction() {
    if (
      !(await confirmAlert({
        title: "Merge Merge Request?",
        message: `Merge !${mr.iid} "${mr.title}"?`,
        primaryAction: { title: "Merge", style: Alert.ActionStyle.Destructive },
      }))
    ) {
      return;
    }
    try {
      await gitlab.put(`projects/${mr.project_id}/merge_requests/${mr.iid}/merge`);
      showToast(Toast.Style.Success, "Merged");
      if (props.finished) {
        props.finished();
      }
    } catch (error) {
      showErrorToast(getErrorMessage(error), "Failed to Merge");
    }
  }
  if (mr.state === "opened") {
    return (
      <Action
        title="Merge"
        shortcut={props.shortcut}
        icon={{ source: GitLabIcons.merged, tintColor: Color.PrimaryText }}
        onAction={handleAction}
      />
    );
  } else {
    return null;
  }
}

export function MRTodoActionSection(props: {
  mr: MergeRequest;
  shortcut?: Keyboard.Shortcut;
  finished?: () => void;
}): React.ReactElement | null {
  const mr = props.mr;
  const { todos, performRefetch } = useTodos();
  const existingTodo = findTodoForMR(todos, mr);

  if (mr.state !== "opened" && !existingTodo) {
    return null;
  }

  if (existingTodo) {
    async function markAsDone() {
      try {
        await gitlab.post(`todos/${existingTodo.id}/mark_as_done`);
        showToast(Toast.Style.Success, "Done", "Todo is now marked as done");
        performRefetch();
        props.finished?.();
      } catch (error) {
        showErrorToast(getErrorMessage(error), "Failed to mark Todo as done");
      }
    }
    return (
      <ActionPanel.Section>
        <Action
          title="Mark as Done"
          shortcut={props.shortcut}
          icon={{ source: Icon.Checkmark, tintColor: Color.Green }}
          onAction={markAsDone}
        />
      </ActionPanel.Section>
    );
  }

  async function addTodo() {
    try {
      await gitlab.post(`projects/${mr.project_id}/merge_requests/${mr.iid}/todo`);
      showToast(Toast.Style.Success, "To do created");
      performRefetch();
      props.finished?.();
    } catch (error) {
      showErrorToast(getErrorMessage(error), "Failed to add to do");
    }
  }

  return (
    <ActionPanel.Section>
      <Action
        title="Add a To-Do"
        shortcut={props.shortcut}
        icon={{ source: GitLabIcons.todo, tintColor: Color.PrimaryText }}
        onAction={addTodo}
      />
    </ActionPanel.Section>
  );
}

export function MergeRequestCopyActions(props: { mr: MergeRequest }) {
  const mr = props.mr;
  return (
    <ActionPanel.Submenu title="Copy" icon={Icon.Clipboard} shortcut={{ modifiers: ["cmd"], key: "c" }}>
      <Action.CopyToClipboard
        title="URL"
        content={mr.web_url}
        icon={{ source: Icon.Link, tintColor: Color.PrimaryText }}
      />
      <Action.CopyToClipboard
        title={`!${mr.iid}`}
        content={mr.iid}
        icon={{ source: Icon.Hashtag, tintColor: Color.PrimaryText }}
      />
      <Action.CopyToClipboard
        title="Title"
        content={mr.title}
        icon={{ source: Icon.Text, tintColor: Color.PrimaryText }}
      />
    </ActionPanel.Submenu>
  );
}

export function MRItemActions(props: { mr: MergeRequest; onDataChange?: () => void }) {
  const mr = props.mr;
  return (
    <React.Fragment>
      {mr.state === "closed" ? (
        <ActionPanel.Section>
          <ReopenMRAction mr={mr} finished={props.onDataChange} />
        </ActionPanel.Section>
      ) : null}
      <ActionPanel.Section>
        <RebaseMRAction shortcut={{ modifiers: ["cmd", "shift"], key: "r" }} mr={mr} finished={props.onDataChange} />
        <MergeMRAction shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }} mr={mr} finished={props.onDataChange} />
        {mr.state === "opened" && <CloseMRAction mr={mr} finished={props.onDataChange} />}
      </ActionPanel.Section>
    </React.Fragment>
  );
}

export function ShowMRCommitsAction(props: { mr: MergeRequest }) {
  const mr = props.mr;
  return (
    <Action.Push
      title="Show Commits"
      icon={{ source: GitLabIcons.commit, tintColor: Color.PrimaryText }}
      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
      target={<ProjectCommitList projectID={mr.project_id} refName={mr.source_branch} />}
    />
  );
}
