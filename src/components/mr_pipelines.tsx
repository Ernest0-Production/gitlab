import { List } from "@raycast/api";
import { useEffect } from "react";
import { useCache } from "../cache";
import { getCIRefreshInterval, gitlab } from "../common";
import { MergeRequest, Pipeline, Project } from "../gitlabapi";
import { daysInSeconds, getErrorMessage, showErrorToast } from "../utils";
import { normalizePipelineForList, PipelineListItem } from "./pipelines";
import useInterval from "use-interval";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type UseMRPipelinesOptions = {
  enabled?: boolean;
  /** Latest N pipelines (GitLab returns newest first). Use `1` for list row CI status. */
  limit?: number;
  /** Paginate through all MR pipelines (pipelines list view). */
  all?: boolean;
};

function mrPipelinesCacheKey(mr: MergeRequest, options: UseMRPipelinesOptions): string {
  if (options.all) {
    return `mrpipelines_all_${mr.project_id}_${mr.iid}`;
  }
  return `mrpipelines_latest_${mr.project_id}_${mr.iid}_${options.limit ?? "default"}`;
}

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

  const { data, isLoading, error, performRefetch } = useCache<Pipeline[] | undefined>(
    mrPipelinesCacheKey(mr, resolved),
    async (): Promise<Pipeline[] | undefined> => {
      if (!enabled) {
        return undefined;
      }
      const params: Record<string, string> = {};
      if (limit !== undefined) {
        params.per_page = `${limit}`;
      }
      const result: Record<string, any>[] | undefined = await gitlab.fetch(
        `projects/${mr.project_id}/merge_requests/${mr.iid}/pipelines`,
        params,
        fetchAll,
      );
      return result?.map((entry) => normalizePipelineForList(entry));
    },
    {
      deps: [mr.project_id, mr.iid, enabled, fetchAll, limit],
      secondsToRefetch: 10,
      secondsToInvalid: daysInSeconds(7),
    },
  );
  return { pipelines: data, isLoading, error, performRefetch };
}

function useMRProject(mr: MergeRequest): {
  project: Project | undefined;
  isLoading: boolean | undefined;
  error: string | undefined;
} {
  const { data, isLoading, error } = useCache<Project | undefined>(
    `mrproject_${mr.project_id}`,
    async () => gitlab.getProject(mr.project_id),
    {
      deps: [mr.project_id],
      secondsToInvalid: daysInSeconds(7),
    },
  );
  return { project: data, isLoading, error };
}

export function MRPipelineList(props: { mr: MergeRequest }) {
  const { mr } = props;
  const navigationTitle = `Pipelines · ${mr.reference_full}`;
  const { pipelines, isLoading, error, performRefetch } = useMRPipelines(mr, { all: true });
  const { project, isLoading: projectLoading, error: projectError } = useMRProject(mr);

  useInterval(() => {
    performRefetch();
  }, getCIRefreshInterval());

  useEffect(() => {
    if (!error) {
      return;
    }
    showErrorToast(getErrorMessage(error), "Could not fetch Pipelines");
  }, [error]);

  useEffect(() => {
    if (!projectError) {
      return;
    }
    showErrorToast(getErrorMessage(projectError), "Could not fetch Project");
  }, [projectError]);

  const projectFullPath = project?.fullPath ?? "";

  const listLoading = isLoading === undefined || projectLoading === undefined || isLoading || projectLoading;

  return (
    <List isLoading={listLoading} navigationTitle={navigationTitle}>
      <List.Section title="Pipelines" subtitle={pipelines?.length ? `${pipelines.length}` : undefined}>
        {pipelines?.map((pipeline) => (
          <PipelineListItem
            key={pipeline.id}
            pipeline={pipeline}
            projectFullPath={projectFullPath}
            onRefreshPipelines={performRefetch}
            navigationTitle={navigationTitle}
          />
        ))}
      </List.Section>
      {!listLoading && (!pipelines || pipelines.length === 0) ? (
        <List.EmptyView title="No Pipelines" description="This merge request has no pipelines yet." />
      ) : null}
    </List>
  );
}
