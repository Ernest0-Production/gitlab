import { List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useRef } from "react";
import { gitlab } from "../common";
import { MergeRequest, Project } from "../gitlabapi";
import { getErrorMessage } from "../utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ListPagination = List.Props["pagination"];

/**
 * Paginated Merge Request data provider backed by `useCachedPromise`.
 * The fetch function is kept constant (per `useCachedPromise` contract): `cacheKey`
 * drives revalidation, while `buildParams`/`project` are read through refs so the
 * latest values are used without recreating the function.
 */
export function usePaginatedMergeRequests(options: {
  cacheKey: string;
  buildParams: () => Record<string, any>;
  project?: Project;
  execute?: boolean;
  keepPreviousData?: boolean;
  onError?: (error: Error) => void;
}): {
  mrs: MergeRequest[] | undefined;
  isLoading: boolean;
  error: string | undefined;
  performRefetch: () => void;
  pagination: ListPagination;
} {
  const buildParamsRef = useRef(options.buildParams);
  buildParamsRef.current = options.buildParams;
  const projectRef = useRef(options.project);
  projectRef.current = options.project;

  // `cacheKey` is the only argument so that changing it triggers a revalidation,
  // while the request itself reads the latest params/project through refs.
  const { data, isLoading, error, revalidate, pagination } = useCachedPromise(
    (cacheKey: string) => async (paginationOptions: { page: number }) => {
      void cacheKey;
      const { mergeRequests, hasMore } = await gitlab.getMergeRequestsPage(
        buildParamsRef.current(),
        paginationOptions.page + 1,
        projectRef.current,
      );
      return { data: mergeRequests, hasMore };
    },
    [options.cacheKey],
    { execute: options.execute, keepPreviousData: options.keepPreviousData, onError: options.onError },
  );

  return {
    mrs: data,
    isLoading,
    error: error ? getErrorMessage(error) : undefined,
    performRefetch: revalidate,
    pagination,
  };
}
