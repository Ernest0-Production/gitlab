import { Action, ActionPanel, List, Icon, Image, Color } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getCIRefreshInterval, getGitLabGQL, gitlab } from "../common";
import { gql } from "@apollo/client";
import {
  capitalizeFirstLetter,
  copyShortcut,
  formatDate,
  formatDateTime,
  getErrorMessage,
  getIdFromGqlId,
  showErrorToast,
} from "../utils";
import { JobList } from "./jobs";
import {
  CancelPipelineAction,
  isCancelablePipeline,
  PipelineItemActions,
  RetryPipelineAction,
  RunPipelineAction,
} from "./pipeline_actions";
import useInterval from "use-interval";
import { GitLabOpenInBrowserAction } from "./actions";
import { GitLabIcons } from "../icons";
import { Pipeline } from "../gitlabapi";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GqlPipelineNode {
  id: string;
  iid: string;
  project: { id: string };
  status: string;
  path: string;
  ref: string;
  sha: string;
  startedAt?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

const GET_PIPELINES = gql`
  query GetProjectPipeplines($fullPath: ID!) {
    project(fullPath: $fullPath) {
      pipelines {
        nodes {
          id
          iid
          project {
            id
          }
          status
          active
          path
          ref
          sha
          startedAt
          duration
          createdAt
          updatedAt
          finishedAt
        }
      }
    }
  }
`;

function getIcon(status: string): Image {
  switch (status.toLowerCase()) {
    case "success": {
      return { source: GitLabIcons.status_success, tintColor: Color.Green };
    }
    case "created": {
      return { source: GitLabIcons.status_created, tintColor: Color.Yellow };
    }
    case "pending": {
      return { source: GitLabIcons.status_pending, tintColor: Color.Yellow };
    }
    case "running": {
      return { source: GitLabIcons.status_running, tintColor: Color.Blue };
    }
    case "failed": {
      return { source: GitLabIcons.status_failed, tintColor: Color.Red };
    }
    case "canceled": {
      return { source: GitLabIcons.status_canceled, tintColor: Color.PrimaryText };
    }
    default:
      return { source: GitLabIcons.status_notfound, tintColor: Color.Magenta };
  }
}

function getStatusText(status: string) {
  if (status == "success") {
    return "passed";
  } else {
    return status;
  }
}

function pipelineTimestamp(pipeline: Pipeline, field: "finished" | "started" | "created"): string | undefined {
  if (field === "finished") {
    return pipeline.finished_at || (pipeline as { finishedAt?: string }).finishedAt;
  }
  if (field === "started") {
    return pipeline.started_at || (pipeline as { startedAt?: string }).startedAt;
  }
  return pipeline.created_at || (pipeline as { createdAt?: string }).createdAt;
}

function formatPipelineShaSubtitle(sha: string | undefined): string {
  if (!sha) {
    return "";
  }
  return sha.length > 8 ? sha.slice(0, 8) : sha;
}

export function normalizePipelineForList(data: Record<string, any>): Pipeline {
  const pipeline = new Pipeline();
  pipeline.id = data.id;
  pipeline.iid = `${data.iid}`;
  pipeline.projectId = `${data.project_id}`;
  pipeline.status = data.status ?? "";
  pipeline.ref = data.ref ?? "";
  pipeline.sha = data.sha ?? "";
  pipeline.webUrl = data.web_url ?? data.webUrl ?? "";
  pipeline.created_at = data.created_at ?? data.createdAt ?? "";
  pipeline.updated_at = data.updated_at ?? data.updatedAt ?? "";
  pipeline.started_at = data.started_at ?? data.startedAt ?? "";
  pipeline.finished_at = data.finished_at ?? data.finishedAt ?? "";
  pipeline.duration = data.duration ?? 0;
  return pipeline;
}

function getPipelineListAccessory(pipeline: Pipeline): List.Item.Accessory | undefined {
  const finishedAt = pipelineTimestamp(pipeline, "finished");
  const startedAt = pipelineTimestamp(pipeline, "started");
  const createdAt = pipelineTimestamp(pipeline, "created");
  const iso = finishedAt ?? startedAt ?? createdAt;
  if (!iso) {
    return undefined;
  }
  const timestamp = new Date(iso);
  const durationSuffix = finishedAt && pipeline.duration ? ` · ${pipeline.duration}s` : "";
  const tooltip = finishedAt
    ? `Finished ${formatDateTime(timestamp)}${durationSuffix}`
    : startedAt
      ? `Started ${formatDateTime(timestamp)}`
      : `Created ${formatDateTime(timestamp)}`;
  return { text: formatDate(timestamp), tooltip };
}

export function PipelineListItem(props: {
  pipeline: Pipeline;
  projectFullPath: string;
  onRefreshPipelines: () => void;
  navigationTitle?: string;
  runRefFallback?: string;
}) {
  const pipeline = props.pipeline;
  const icon = getIcon(pipeline.status);
  const dateAccessory = getPipelineListAccessory(pipeline);
  return (
    <List.Item
      id={`${pipeline.id}`}
      title={pipeline.id.toString()}
      icon={{
        value: icon,
        tooltip: pipeline?.status
          ? `Status: ${capitalizeFirstLetter(getStatusText(pipeline.status.toLowerCase()))}`
          : "",
      }}
      subtitle={formatPipelineShaSubtitle(pipeline.sha)}
      accessories={dateAccessory ? [dateAccessory] : []}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Show Jobs"
              target={
                <JobList
                  projectFullPath={props.projectFullPath}
                  pipelineID={pipeline.id}
                  pipelineIID={pipeline.iid}
                  navigationTitle={props.navigationTitle}
                />
              }
              icon={{ source: Icon.Terminal, tintColor: Color.PrimaryText }}
            />
            <GitLabOpenInBrowserAction url={pipeline.webUrl} />
            <Action.CopyToClipboard title="Copy URL" content={pipeline.webUrl} shortcut={copyShortcut} />
            <RetryPipelineAction pipeline={props.pipeline} onRetryFinished={props.onRefreshPipelines} />
            {isCancelablePipeline(pipeline) ? (
              <CancelPipelineAction pipeline={props.pipeline} onRefreshPipelines={props.onRefreshPipelines} />
            ) : null}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <PipelineItemActions
              pipeline={props.pipeline}
              runRefFallback={props.runRefFallback}
              onRefreshPipelines={props.onRefreshPipelines}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function useProjectPipelineRunContext(projectFullPath: string): {
  projectId: string;
  defaultBranch: string;
} {
  const { data } = usePromise(
    async (fullPath: string) => {
      const project = await gitlab.fetch(`projects/${encodeURIComponent(fullPath)}`);
      return { projectId: `${project.id}`, defaultBranch: (project.default_branch as string) ?? "" };
    },
    [projectFullPath],
    // Failure falls back to empty context below; no toast (matches the previous silent catch).
    { onError: () => undefined },
  );

  return { projectId: data?.projectId ?? "", defaultBranch: data?.defaultBranch ?? "" };
}

export function PipelineList(props: { projectFullPath: string; navigationTitle?: string }) {
  const { pipelines, error, isLoading, refresh } = useSearch(props.projectFullPath);
  const { projectId, defaultBranch } = useProjectPipelineRunContext(props.projectFullPath);
  const runRef = pipelines[0]?.ref || defaultBranch;
  const runProjectId = pipelines[0]?.projectId || projectId;

  useInterval(() => {
    refresh();
  }, getCIRefreshInterval());
  if (error) {
    showErrorToast(error, "Cannot search Pipelines");
  }
  return (
    <List
      isLoading={isLoading}
      navigationTitle={props.navigationTitle || "Pipelines"}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <RunPipelineAction
              projectId={runProjectId}
              ref={runRef}
              onFinished={refresh}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <List.Section title="Pipelines">
        {pipelines?.map((pipeline) => (
          <PipelineListItem
            key={pipeline.id}
            pipeline={pipeline}
            projectFullPath={props.projectFullPath}
            onRefreshPipelines={refresh}
            navigationTitle={props.navigationTitle}
            runRefFallback={defaultBranch}
          />
        ))}
      </List.Section>
    </List>
  );
}

export function useSearch(projectFullPath: string): {
  pipelines: Pipeline[];
  error?: string;
  isLoading: boolean;
  refresh: () => void;
} {
  const { data, error, isLoading, revalidate } = usePromise(
    async (fullPath: string): Promise<Pipeline[]> => {
      const data = await getGitLabGQL().client.query({
        query: GET_PIPELINES,
        variables: { fullPath },
        fetchPolicy: "network-only",
      });
      return data.data.project.pipelines.nodes.map((pipeline: GqlPipelineNode) =>
        normalizePipelineForList({
          id: getIdFromGqlId(pipeline.id),
          iid: pipeline.iid,
          project_id: getIdFromGqlId(pipeline.project.id),
          status: pipeline.status,
          ref: pipeline.ref,
          web_url: `${getGitLabGQL().url}${pipeline.path}`,
          created_at: pipeline.createdAt,
          updated_at: pipeline.updatedAt,
          started_at: pipeline.startedAt,
          duration: pipeline.duration,
          finished_at: pipeline.finishedAt,
          sha: pipeline.sha,
        }),
      );
    },
    [projectFullPath],
    // The error is surfaced via `error` and toasted by the caller in render.
    { onError: () => undefined },
  );

  return { pipelines: data ?? [], error: error ? getErrorMessage(error) : undefined, isLoading, refresh: revalidate };
}
