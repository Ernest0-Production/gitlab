import { ActionPanel, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getCIRefreshInterval, gitlab } from "../common";
import { MergeRequest, Pipeline, Project } from "../gitlabapi";
import { getErrorMessage, showErrorToast } from "../utils";
import { normalizePipelineForList, PipelineListItem } from "./pipelines";
import { RunPipelineAction } from "./pipeline_actions";
import useInterval from "use-interval";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type UseMRPipelinesOptions = {
  enabled?: boolean;
  /** Latest N pipelines (GitLab returns newest first). Use `1` for list row CI status. */
  limit?: number;
  /** Paginate through all MR pipelines (pipelines list view). */
  all?: boolean;
};

export function useMRPipelines(
  mr: MergeRequest,
  options: UseMRPipelinesOptions | boolean = true,
): {
  pipelines: Pipeline[] | undefined;
  isLoading: boolean | undefined;
  error: string | undefined;
  performRefetch: () => void;
} {
  const resolved: UseMRPipelinesOptions =
    typeof options === "boolean" ? { enabled: options } : { enabled: true, ...options };
  const enabled = resolved.enabled ?? true;
  const fetchAll = resolved.all === true;
  const limit = resolved.limit;

  const { data, isLoading, error, revalidate } = useCachedPromise(
    async (
      projectID: number,
      iid: number,
      fetchAll: boolean,
      pageLimit: number | undefined,
    ): Promise<Pipeline[] | undefined> => {
      const params: Record<string, string> = {};
      if (pageLimit !== undefined) {
        params.per_page = `${pageLimit}`;
      }
      const result: Record<string, any>[] | undefined = await gitlab.fetch(
        `projects/${projectID}/merge_requests/${iid}/pipelines`,
        params,
        fetchAll,
      );
      return result?.map((entry) => normalizePipelineForList(entry));
    },
    [mr.project_id, mr.iid, fetchAll, limit],
    { execute: enabled, onError: () => undefined },
  );
  return { pipelines: data, isLoading, error: error ? getErrorMessage(error) : undefined, performRefetch: revalidate };
}

function useMRProject(mr: MergeRequest): {
  project: Project | undefined;
  isLoading: boolean | undefined;
  error: string | undefined;
} {
  const { data, isLoading, error } = useCachedPromise(
    (projectID: number) => gitlab.getProject(projectID),
    [mr.project_id],
    { onError: () => undefined },
  );
  return { project: data, isLoading, error: error ? getErrorMessage(error) : undefined };
}

export function MRPipelineList(props: { mr: MergeRequest }) {
  const { mr } = props;
  const navigationTitle = `Pipelines · ${mr.reference_full}`;
  const { pipelines, isLoading, error, performRefetch } = useMRPipelines(mr, { all: true });
  const { project, isLoading: projectLoading, error: projectError } = useMRProject(mr);

  useInterval(() => {
    performRefetch();
  }, getCIRefreshInterval());

  if (error) {
    showErrorToast(error, "Could not fetch Pipelines");
  }
  if (projectError) {
    showErrorToast(projectError, "Could not fetch Project");
  }

  const projectFullPath = project?.fullPath ?? "";

  const listLoading = isLoading === undefined || projectLoading === undefined || isLoading || projectLoading;
  const runRef = pipelines?.[0]?.ref || mr.source_branch;
  const runProjectId = pipelines?.[0]?.projectId || `${mr.project_id}`;

  return (
    <List
      isLoading={listLoading}
      navigationTitle={navigationTitle}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <RunPipelineAction
              projectId={runProjectId}
              ref={runRef}
              onFinished={performRefetch}
              shortcut={{ modifiers: ["cmd"], key: "n" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    >
      <List.Section title="Pipelines" subtitle={pipelines?.length ? `${pipelines.length}` : undefined}>
        {pipelines?.map((pipeline) => (
          <PipelineListItem
            key={pipeline.id}
            pipeline={pipeline}
            projectFullPath={projectFullPath}
            onRefreshPipelines={performRefetch}
            navigationTitle={navigationTitle}
            runRefFallback={mr.source_branch}
          />
        ))}
      </List.Section>
      {!listLoading && (!pipelines || pipelines.length === 0) ? (
        <List.EmptyView title="No Pipelines" description="This merge request has no pipelines yet." />
      ) : null}
    </List>
  );
}
