import { Action, ActionPanel, Color, Icon, Image, List } from "@raycast/api";
import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../common";
import { User, searchData } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { capitalizeFirstLetter, getErrorMessage, shortify, showErrorToast } from "../utils";
import { DefaultActions, GitLabOpenInBrowserAction } from "./actions";
import { IssueDetailFetch } from "./issues";
import { MRDetailFetch } from "./mr";

export interface PushData {
  commit_count: number;
  action: string;
  ref_type: string;
  commit_from: string;
  commit_to: string;
  ref: string;
  commit_title: string;
  ref_count?: null;
}

export interface Note {
  noteable_iid?: number;
  noteable_id?: number;
  noteable_type?: string;
  body?: string;
}

export interface Event {
  id: number;
  project_id: number;
  action_name: string;
  target_id: number;
  target_iid: number;
  target_type: string;
  target_title: string;
  push_data?: PushData;
  note?: Note;
  author?: User;
}

export function EventListItem(props: { event: Event }) {
  const event = props.event;
  const { data: project, error } = useCachedPromise(
    (projectID: number) => gitlab.getProject(projectID),
    [event.project_id],
    { onError: () => undefined },
  );
  let title = "";
  let subtitle: string | undefined = undefined;
  let icon: Image.ImageLike | undefined;
  const action_name = event.action_name;
  let actionElement: React.ReactNode | undefined;
  switch (action_name) {
    case "updated":
      {
        const actionLabel = capitalizeFirstLetter(event.action_name);
        title = actionLabel;
        if (event.target_type) {
          const targetType = event.target_type.toLowerCase();
          if (targetType) {
            if (targetType === "wikipage::meta") {
              title = `${actionLabel} wiki page ${event.target_title}`;
              icon = { source: GitLabIcons.wiki, tintColor: Color.Green };
            }
          }
        }
      }
      break;
    case "pushed new":
    case "pushed to":
    case "deleted":
      {
        const actionLabel = capitalizeFirstLetter(event.action_name);
        const pushData = event.push_data;
        if (pushData) {
          let iconColor: Color.ColorLike | undefined;
          switch (event.action_name) {
            case "pushed new":
              {
                iconColor = Color.Purple;
              }
              break;
            case "pushed to":
              {
                iconColor = Color.Green;
              }
              break;
            case "deleted":
              {
                iconColor = Color.Red;
              }
              break;
          }
          let iconSource: Image.Source | undefined;
          if (pushData.ref_type === "branch") {
            const ref = pushData.ref;
            title = `${actionLabel} branch ${ref}`;
            iconSource = GitLabIcons.branches;
            if (project && !error && event.action_name !== "deleted") {
              actionElement = (
                <DefaultActions
                  webAction={
                    <GitLabOpenInBrowserAction
                      url={`${project.web_url}/-/tree/${ref}`}
                      title="Open Branch in Browser"
                    />
                  }
                />
              );
            }
          } else if (pushData.ref_type === "tag") {
            title = `${actionLabel} tag ${pushData.ref}`;
            iconSource = GitLabIcons.tag;
          }
          icon = iconSource && { source: iconSource, tintColor: iconColor };
        }
      }
      break;
    case "created":
    case "joined":
      {
        const actionLabel = capitalizeFirstLetter(event.action_name);
        title = `${actionLabel} project`;
        icon = { source: Icon.Circle, tintColor: Color.Green };
        if (project && !error) {
          title += ` ${project.fullPath}`;
        }
        if (project && !error && event.action_name !== "deleted") {
          actionElement = (
            <DefaultActions
              webAction={<GitLabOpenInBrowserAction url={`${project.web_url}`} title="Open Project in Browser" />}
            />
          );
        }
      }
      break;
    case "accepted":
    case "commented on":
    case "opened":
    case "closed":
      {
        const actionLabel = capitalizeFirstLetter(event.action_name);
        if (event.target_type) {
          const targetType = event.target_type.toLowerCase();
          if (targetType === "issue") {
            title = `${actionLabel} issue #${event.target_iid}`;
            switch (event.action_name) {
              case "closed":
                {
                  icon = { source: GitLabIcons.issue, tintColor: Color.Red };
                  subtitle = shortify(event.target_title, 50);
                }
                break;
              case "opened":
                {
                  icon = { source: GitLabIcons.issue, tintColor: Color.Green };
                  subtitle = shortify(event.target_title, 50);
                }
                break;
              case "commented on":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Green };
                }
                break;
            }
            if (project && !error) {
              actionElement = (
                <DefaultActions
                  action={
                    <Action.Push
                      title="Open Issue"
                      icon={{ source: GitLabIcons.issue, tintColor: Color.PrimaryText }}
                      target={<IssueDetailFetch project={project} issueId={event.target_iid} />}
                    />
                  }
                  webAction={
                    <GitLabOpenInBrowserAction
                      url={`${project.web_url}/-/issues/${event.target_iid}`}
                      title="Open Issue in Browser"
                    />
                  }
                />
              );
            }
          } else if (targetType == "mergerequest") {
            switch (event.action_name) {
              case "closed":
                {
                  icon = { source: GitLabIcons.merged, tintColor: Color.Purple };
                  subtitle = shortify(event.target_title, 50);
                }
                break;
              case "opened":
                {
                  icon = { source: GitLabIcons.mropen, tintColor: Color.Green };
                  subtitle = shortify(event.target_title, 50);
                }
                break;
              case "accepted":
                {
                  icon = { source: GitLabIcons.mraccepted, tintColor: Color.Green };
                  subtitle = shortify(event.target_title, 50);
                }
                break;
              case "commented on":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Green };
                  subtitle = shortify(event.target_title, 50);
                }
                break;
            }
            title = `${actionLabel} merge request !${event.target_iid}`;
            if (project && !error) {
              actionElement = (
                <DefaultActions
                  action={
                    <Action.Push
                      title="Open Merge Request"
                      icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
                      target={<MRDetailFetch project={project} mrId={event.target_iid} />}
                    />
                  }
                  webAction={
                    <GitLabOpenInBrowserAction
                      url={`${project.web_url}/-/merge_requests/${event.target_iid}`}
                      title="Open Merge Request in Browser"
                    />
                  }
                />
              );
            }
          } else if (targetType === "milestone") {
            switch (event.action_name) {
              case "opened":
                {
                  icon = { source: GitLabIcons.milestone, tintColor: Color.Green };
                }
                break;
              case "closed":
                {
                  icon = { source: GitLabIcons.milestone, tintColor: Color.Purple };
                }
                break;
            }
            title = `${actionLabel} milestone ${event.target_title}`;
            if (project && !error) {
              actionElement = (
                <DefaultActions
                  webAction={
                    <GitLabOpenInBrowserAction
                      url={`${project.web_url}/-/milestones/${event.target_iid}`}
                      title="Open Milestone in Browser"
                    />
                  }
                />
              );
            }
          } else if (targetType === "discussionnote") {
            switch (event.action_name) {
              case "opened":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Green };
                }
                break;
              case "closed":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Purple };
                }
                break;
              case "commented on":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Yellow };
                }
                break;
            }
            title = `${actionLabel} discussion note`;
            if (
              !error &&
              project &&
              event.target_iid &&
              event.note &&
              event.note.noteable_id &&
              event.note.noteable_type
            ) {
              let slug = "";
              const noteableType = event.note.noteable_type.toLowerCase();
              if (noteableType === "mergerequest" && event.note && event.note.noteable_iid) {
                slug = `/-/merge_requests/${event.note.noteable_iid}#note_${event.target_iid}`;
              } else if (noteableType === "issue" && event.note && event.note.noteable_iid) {
                slug = `/-/issues/${event.note.noteable_iid}#note_${event.target_iid}`;
              }
              if (slug) {
                actionElement = (
                  <DefaultActions
                    webAction={
                      <GitLabOpenInBrowserAction url={`${project.web_url}${slug}`} title="Open Comment in Browser" />
                    }
                  />
                );
              }
            }
          } else if (targetType === "note" || targetType == "diffnote") {
            switch (event.action_name) {
              case "opened":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Green };
                }
                break;
              case "closed":
                {
                  icon = { source: GitLabIcons.comment, tintColor: Color.Purple };
                }
                break;
              case "commented on":
                {
                  const body = event.note?.body;
                  if (body !== undefined && body.length > 0) {
                    subtitle = shortify(body, 50);
                  }
                  icon = { source: GitLabIcons.comment, tintColor: Color.Yellow };
                }
                break;
            }
            title = `${actionLabel} note`;
            if (
              !error &&
              project &&
              event.target_iid &&
              event.note &&
              event.note.noteable_id &&
              event.note.noteable_type
            ) {
              let slug = "";
              const noteableType = event.note.noteable_type.toLowerCase();
              if (noteableType === "mergerequest" && event.note && event.note.noteable_iid) {
                slug = `/-/merge_requests/${event.note.noteable_iid}#note_${event.target_iid}`;
              } else if (noteableType === "issue" && event.note && event.note.noteable_iid) {
                slug = `/-/issues/${event.note.noteable_iid}#note_${event.target_iid}`;
              }
              if (slug) {
                actionElement = (
                  <DefaultActions
                    webAction={
                      <GitLabOpenInBrowserAction url={`${project.web_url}${slug}`} title="Open Comment in Browser" />
                    }
                  />
                );
              }
            }
          } else {
            console.log(event);
          }
        } else {
          console.log(event);
        }
      }
      break;
    case "approved":
      {
        if (event.target_type) {
          const targetType = event.target_type.toLowerCase();
          if (targetType === "mergerequest") {
            const target_title = event.target_title;
            const mrIId = event.target_iid;
            title = `Approved Merge Request !${mrIId} "${target_title}"`;
            icon = { source: "approved.png", tintColor: Color.Green };
            if (project) {
              const slug = `/-/merge_requests/${mrIId}`;
              actionElement = (
                <DefaultActions
                  action={
                    <Action.Push
                      title="Open Merge Request"
                      icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
                      target={<MRDetailFetch project={project} mrId={mrIId} />}
                    />
                  }
                  webAction={
                    <GitLabOpenInBrowserAction
                      url={`${project.web_url}${slug}`}
                      title="Open Merge Request in Browser"
                    />
                  }
                />
              );
            }
          }
        }
      }
      break;
    default:
      {
        console.log("unknown action_name");
        console.log(event);
      }
      break;
  }
  if (!title && !icon && !actionElement) {
    title = `Unknown event: ${action_name}`;
    icon = { source: Icon.QuestionMark, tintColor: Color.SecondaryText };
    actionElement = <Action.CopyToClipboard content={JSON.stringify(event, null, 2)} title="Copy Event Details" />;
  }
  const accessoryTitle = project && !error ? project.name_with_namespace : undefined;

  return (
    <List.Item
      title={{ value: title || "", tooltip: event.target_title }}
      subtitle={subtitle}
      icon={icon}
      accessories={[
        { text: accessoryTitle },
        {
          icon: event.author ? { source: event.author.avatar_url, mask: Image.Mask.Circle } : undefined,
          tooltip: event.author ? event.author.name : undefined,
        },
      ]}
      actions={<ActionPanel>{actionElement && actionElement}</ActionPanel>}
    />
  );
}

enum ScopeType {
  MyActivities = "my",
  MyProjects = "myprojects",
}

function EventListDropdown(props: { onChange: (text: string) => void }) {
  return (
    <List.Dropdown tooltip="Scope" onChange={props.onChange}>
      <List.Dropdown.Item value={ScopeType.MyActivities} title="My Activities" />
      <List.Dropdown.Item value={ScopeType.MyProjects} title="My Projects" />
    </List.Dropdown>
  );
}

function EventListEmptyView() {
  return <List.EmptyView title="No Activity" icon={{ source: GitLabIcons.activity, tintColor: Color.PrimaryText }} />;
}

export function EventList() {
  const [scope, setScope] = useState<string>(ScopeType.MyActivities);
  const [searchText, setSearchText] = useState<string>();
  const { data, error, isLoading } = useCachedPromise(
    async (scopeType: string): Promise<Event[]> => {
      const params: Record<string, string> = {};
      if (scopeType === ScopeType.MyProjects) {
        params.scope = "all";
      }
      const events = (await gitlab.fetch("events", params)) as Event[];
      return events;
    },
    [scope],
    { onError: () => undefined },
  );
  if (error) {
    showErrorToast(getErrorMessage(error), "Cannot search Events");
  }

  if (!data) {
    return <List isLoading={true} />;
  }
  const events: Event[] = searchData<Event>(data, {
    search: searchText || "",
    keys: ["action_name", "target_title"],
    limit: 50,
  });
  return (
    <List
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
      searchBarAccessory={<EventListDropdown onChange={setScope} />}
    >
      {events.map((event) => (
        <EventListItem key={event.id} event={event} />
      ))}
      <EventListEmptyView />
    </List>
  );
}
