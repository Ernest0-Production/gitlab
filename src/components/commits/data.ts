import { List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useRef } from "react";
import { gitlab } from "../../common";
import { getErrorMessage } from "../../utils";
import { Commit } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ListPagination = List.Props["pagination"];

export function usePaginatedProjectCommits(options: {
  cacheKey: string;
  projectID: number;
  refName?: string;
  execute?: boolean;
  keepPreviousData?: boolean;
}): {
  commits: Commit[] | undefined;
  isLoading: boolean;
  error: string | undefined;
  performRefetch: () => void;
  pagination: ListPagination;
} {
  const projectIDRef = useRef(options.projectID);
  projectIDRef.current = options.projectID;
  const refNameRef = useRef(options.refName);
  refNameRef.current = options.refName;

  const { data, isLoading, error, revalidate, pagination } = useCachedPromise(
    (cacheKey: string) => async (paginationOptions: { page: number }) => {
      void cacheKey;
      const params: Record<string, string> = {};
      if (refNameRef.current) {
        params.ref_name = refNameRef.current;
      }
      const { data: pageData, hasMore } = await gitlab.fetchPaged(
        `projects/${projectIDRef.current}/repository/commits`,
        params,
        paginationOptions.page + 1,
        20,
      );
      const commits: Commit[] = pageData.map((item: any) => item as Commit);
      return { data: commits, hasMore };
    },
    [options.cacheKey],
    { execute: options.execute, keepPreviousData: options.keepPreviousData },
  );

  return {
    commits: data,
    isLoading,
    error: error ? getErrorMessage(error) : undefined,
    performRefetch: revalidate,
    pagination,
  };
}

export function usePaginatedMergeRequestCommits(options: {
  cacheKey: string;
  projectID: number;
  mrIID: number;
  execute?: boolean;
  keepPreviousData?: boolean;
}): {
  commits: Commit[] | undefined;
  isLoading: boolean;
  error: string | undefined;
  performRefetch: () => void;
  pagination: ListPagination;
} {
  const projectIDRef = useRef(options.projectID);
  projectIDRef.current = options.projectID;
  const mrIIDRef = useRef(options.mrIID);
  mrIIDRef.current = options.mrIID;

  const { data, isLoading, error, revalidate, pagination } = useCachedPromise(
    (cacheKey: string) => async (paginationOptions: { page: number }) => {
      void cacheKey;
      const { data: pageData, hasMore } = await gitlab.fetchPaged(
        `projects/${projectIDRef.current}/merge_requests/${mrIIDRef.current}/commits`,
        {},
        paginationOptions.page + 1,
        20,
      );
      const commits: Commit[] = pageData.map((item: any) => item as Commit);
      return { data: commits, hasMore };
    },
    [options.cacheKey],
    { execute: options.execute, keepPreviousData: options.keepPreviousData },
  );

  return {
    commits: data,
    isLoading,
    error: error ? getErrorMessage(error) : undefined,
    performRefetch: revalidate,
    pagination,
  };
}
