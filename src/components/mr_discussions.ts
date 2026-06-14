import { MRDiscussion, MergeRequest } from "../gitlabapi";

interface MRDiscussionStats {
  resolved: number;
  resolvableTotal: number;
}

export function isDiscussionResolved(discussion: MRDiscussion): boolean {
  if (discussion.resolved === true) {
    return true;
  }
  const resolvableNotes = discussion.notes?.filter((note) => note.resolvable && !note.system) ?? [];
  if (resolvableNotes.length === 0) {
    return false;
  }
  return resolvableNotes.every((note) => note.resolved);
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

export function getMRDiscussionMetadataLabel(stats: MRDiscussionStats | undefined): string | undefined {
  if (stats && stats.resolvableTotal > 0) {
    return `${stats.resolved}/${stats.resolvableTotal}`;
  }
  return undefined;
}
