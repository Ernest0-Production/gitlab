import { Action, ActionPanel, Alert, Color, confirmAlert, Icon, Image, Keyboard, showToast, Toast } from "@raycast/api";
import React from "react";
import { gitlab } from "../common";
import { MergeRequest } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { copyMarkdownShortcut, copyShortcut } from "../utils";
import { MRCommitList } from "./commits/list";
import { MRPipelineList } from "./mr_pipelines";
import { findTodoForMR, useTodos } from "./todo/utils";
import { showFailureToast } from "@raycast/utils";

async function createNote(mr: MergeRequest, body: string): Promise<void> {
  return await gitlab.post(`projects/${mr.project_id}/merge_requests/${mr.iid}/notes`, { body: body });
}

export function CloseMRAction(props: { mr: MergeRequest; finished?: () => void }) {
  async function handleAction() {
    if (
      !(await confirmAlert({
        title: "Close Merge Request?",
        message: `Close !${props.mr.iid} "${props.mr.title}"?`,
        primaryAction: { title: "Close", style: Alert.ActionStyle.Destructive } }))
    ) {
      return;
    }
    try {
      await createNote(props.mr, "/close");
      showToast(Toast.Style.Success, "Closed");
      if (props.finished) {
        props.finished();
      }
    } catch (error) {
      showFailureToast(error, { title: "Failed to close Merge Request" });
    }
  }
  return (
    <Action
      title="Close"
      icon={{ source: GitLabIcons.mropen, tintColor: Color.Red, mask: Image.Mask.Circle }}
      style={Action.Style.Destructive}
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
      onAction={handleAction}
    />
  );
}

export function ReopenMRAction(props: { mr: MergeRequest; finished?: () => void }) {
  async function handleAction() {
    try {
      await createNote(props.mr, "/reopen");
      showToast(Toast.Style.Success, "Reopened");
      if (props.finished) {
        props.finished();
      }
    } catch (error) {
      showFailureToast(error, { title: "Failed to reopen Merge Request" });
    }
  }
  return <Action title="Reopen" icon={{ source: Icon.ExclamationMark }} onAction={handleAction} />;
}

export function RebaseMRAction(props: { mr: MergeRequest; shortcut?: Keyboard.Shortcut; finished?: () => void }) {
  async function handleAction() {
    if (
      !(await confirmAlert({
        title: "Rebase Merge Request?",
        message: `Rebase !${props.mr.iid} "${props.mr.title}"?`,
        primaryAction: { title: "Rebase", style: Alert.ActionStyle.Destructive } }))
    ) {
      return;
    }
    try {
      await createNote(props.mr, "/rebase");
      showToast(Toast.Style.Success, "Rebased");
      props.finished?.();
    } catch (error) {
      showFailureToast(error, { title: "Failed to rebase Merge Request" });
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
  async function handleAction() {
    if (
      !(await confirmAlert({
        title: "Merge Merge Request?",
        message: `Merge !${props.mr.iid} "${props.mr.title}"?`,
        primaryAction: { title: "Merge", style: Alert.ActionStyle.Destructive } }))
    ) {
      return;
    }
    try {
      await gitlab.put(`projects/${props.mr.project_id}/merge_requests/${props.mr.iid}/merge`);
      showToast(Toast.Style.Success, "Merged");
      if (props.finished) {
        props.finished();
      }
    } catch (error) {
      showFailureToast(error, { title: "Failed to Merge" });
    }
  }
  if (props.mr.state === "opened" && props.mr.user?.can_merge === true) {
    return (
      <Action
        title="Merge"
        shortcut={props.shortcut}
        icon={{ source: GitLabIcons.merged, tintColor: Color.PrimaryText }}
        onAction={handleAction}
      />
    );
  }
  return null;
}

function MRTodoAction(props: {
  mr: MergeRequest;
  shortcut?: Keyboard.Shortcut;
  finished?: () => void;
}): React.ReactElement | null {
  const { todos, performRefetch } = useTodos();
  const existingTodo = findTodoForMR(todos, props.mr);

  if (props.mr.state !== "opened" && !existingTodo) {
    return null;
  }

  if (existingTodo) {
    async function markAsDone() {
      try {
        await gitlab.post(`todos/${existingTodo!.id}/mark_as_done`);
        showToast(Toast.Style.Success, "Done", "Todo is now marked as done");
        performRefetch();
        props.finished?.();
      } catch (error) {
        showFailureToast(error, { title: "Failed to mark Todo as done" });
      }
    }
    return (
      <Action
        title="Mark as Done"
        shortcut={props.shortcut}
        icon={{ source: Icon.Checkmark, tintColor: Color.Green }}
        onAction={markAsDone}
      />
    );
  }

  async function addTodo() {
    try {
      await gitlab.post(`projects/${props.mr.project_id}/merge_requests/${props.mr.iid}/todo`);
      showToast(Toast.Style.Success, "To do created");
      performRefetch();
      props.finished?.();
    } catch (error) {
      showFailureToast(error, { title: "Failed to add to do" });
    }
  }

  return (
    <Action
      title="Add a To-Do"
      shortcut={props.shortcut}
      icon={{ source: GitLabIcons.todo, tintColor: Color.PrimaryText }}
      onAction={addTodo}
    />
  );
}

export function MRCopySection(props: { mr: MergeRequest; showCopyMarkdown?: boolean }): React.ReactElement {
  return (
    <ActionPanel.Section>
      <Action.CopyToClipboard title="Copy URL" content={props.mr.web_url} shortcut={copyShortcut} />
      {props.showCopyMarkdown && (
        <Action.CopyToClipboard
          title="Copy Markdown"
          content={`[${props.mr.title}](${props.mr.web_url})`}
          shortcut={copyMarkdownShortcut}
        />
      )}
    </ActionPanel.Section>
  );
}

export function MRItemActions(props: {
  mr: MergeRequest;
  onDataChange?: () => void;
  todoShortcut?: Keyboard.Shortcut;
}) {
  return (
    <React.Fragment>
      {props.mr.state === "closed" && (
        <ActionPanel.Section>
          <ReopenMRAction mr={props.mr} finished={props.onDataChange} />
        </ActionPanel.Section>
      )}
      <ActionPanel.Section>
        <MRTodoAction mr={props.mr} shortcut={props.todoShortcut} finished={props.onDataChange} />
        <RebaseMRAction
          shortcut={{ modifiers: ["cmd", "shift"], key: "r" }}
          mr={props.mr}
          finished={props.onDataChange}
        />
        <MergeMRAction
          shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
          mr={props.mr}
          finished={props.onDataChange}
        />
        {props.mr.state === "opened" && <CloseMRAction mr={props.mr} finished={props.onDataChange} />}
      </ActionPanel.Section>
    </React.Fragment>
  );
}

export function ShowMRCommitsAction(props: { mr: MergeRequest }) {
  return (
    <Action.Push
      title="Show Commits"
      icon={{ source: GitLabIcons.commit, tintColor: Color.PrimaryText }}
      shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
      target={<MRCommitList projectID={props.mr.project_id} mrIID={props.mr.iid} navigationTitle={props.mr.title} />}
    />
  );
}

export function ShowMRPipelinesAction(props: { mr: MergeRequest }) {
  return (
    <Action.Push
      title="Show Pipelines"
      icon={{ source: GitLabIcons.ci, tintColor: Color.PrimaryText }}
      shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
      target={<MRPipelineList mr={props.mr} />}
    />
  );
}

export function RefreshMergeRequestsAction(props: { onRefresh?: () => void }) {
  return (
    <Action
      title="Refresh"
      icon={{ source: Icon.ArrowClockwise, tintColor: Color.PrimaryText }}
      shortcut={{ modifiers: ["cmd"], key: "r" }}
      onAction={() => props.onRefresh?.()}
    />
  );
}
