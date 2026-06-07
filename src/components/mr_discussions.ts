import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../common";
import { MRDiscussion, MergeRequest } from "../gitlabapi";

interface MRDiscussionStats {
  resolved: number;
  resolvableTotal: number;
}

function isDiscussionResolvable(discussion: MRDiscussion): boolean {
  if (discussion.resolvable === true) {
    return true;
  }
  return discussion.notes?.some((note) => note.resolvable && !note.system) ?? false;
}

function isDiscussionResolved(discussion: MRDiscussion): boolean {
  if (discussion.resolved === true) {
    return true;
  }
  const resolvableNotes = discussion.notes?.filter((note) => note.resolvable && !note.system) ?? [];
  if (resolvableNotes.length === 0) {
    return false;
  }
  return resolvableNotes.every((note) => note.resolved);
}

function countMRDiscussionStats(discussions: MRDiscussion[]): MRDiscussionStats {
  let resolved = 0;
  let resolvableTotal = 0;
  for (const discussion of discussions) {
    if (!isDiscussionResolvable(discussion)) {
      continue;
    }
    resolvableTotal++;
    if (isDiscussionResolved(discussion)) {
      resolved++;
    }
  }
  return { resolved, resolvableTotal };
}

export function discussionStatsFromMergeRequest(mr: MergeRequest): MRDiscussionStats | undefined {
  if (
    mr.resolved_discussions_count === undefined ||
    mr.resolvable_discussions_count === undefined ||
    mr.resolvable_discussions_count <= 0
  ) {
    return undefined;
  }
  return {
    resolved: mr.resolved_discussions_count,
    resolvableTotal: mr.resolvable_discussions_count,
  };
}

export function getMRDiscussionMetadataLabel(
  mr: MergeRequest,
  stats: MRDiscussionStats | undefined,
  isLoading?: boolean,
): string | undefined {
  if (isLoading) {
    return "Loading...";
  }
  if (stats && stats.resolvableTotal > 0) {
    return `${stats.resolved}/${stats.resolvableTotal}`;
  }
  return undefined;
}

export function useMRDiscussionStats(mr: MergeRequest): {
  stats: MRDiscussionStats | undefined;
  isLoading: boolean | undefined;
} {
  const hasListCounts = mr.resolved_discussions_count !== undefined && mr.resolvable_discussions_count !== undefined;
  const { data, isLoading } = useCachedPromise(
    async (projectID: number, iid: number): Promise<MRDiscussionStats | undefined> => {
      const discussions = await gitlab.getMergeRequestDiscussions(projectID, iid);
      const stats = countMRDiscussionStats(discussions);
      if (stats.resolvableTotal <= 0) {
        return undefined;
      }
      return stats;
    },
    [mr.project_id, mr.iid],
    { execute: !hasListCounts },
  );
  return {
    stats: discussionStatsFromMergeRequest(mr) ?? data,
    isLoading: hasListCounts ? false : isLoading,
  };
}
