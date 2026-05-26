## Learned User Preferences

- When changing this Raycast GitLab extension, preserve existing code style and structure; do not refactor unrelated patterns or drift from local conventions.
- Run requested terminal, lint, and Raycast dev/debug commands yourself when asked instead of only describing them.

## Learned Workspace Facts

- Search Merge Requests UI lives in `src/components/mr_search.tsx` (entry `src/mr_search.tsx`); the AI tool is `src/tools/search-merge-requests.ts` and is separate from the List UI.
- Search Merge Requests uses `MyProjectsDropdown` with `includeAllItem={false}`: only concrete repositories, no "All Projects"; a project must be selected before MRs load.
- Search Merge Requests groups MRs into "Created by me", "Assigned to Review" (reviewer, not author; hidden when empty), and "Other" without re-sorting within a section; Sort By (`mr_sort.tsx`, ⌘S) sets GitLab `order_by` ("Default" omits the param).
- `MyProjectsDropdown` in `src/components/project.tsx` supports `includeAllItem` (default `true`); My Merge Requests and Reviews keep "All Projects".
- My Merge Requests hides author subtitle and avatar accessory on list rows via `showAuthor={false}` on `MRListItem`; Search MR and other MR lists keep the default (`showAuthor` true).
- MR list side panel: `useMRListDetails()` + `MRListDetailsToggleAction` (⌘⇧D). Metadata column: `useMRListMetadata()` + `MRListMetadataToggleAction` (⌘⇧I, only when side panel open). Side panel uses `MRListDetailMetadata`, full detail uses `MRDetailMetadata` in `mr_metadata.tsx`; the former `listdetails` preference was removed from `package.json`.
- Shared MR UI is split across `mr.tsx`, `mr_actions.tsx`, `mr_metadata.tsx`, `mr_discussions.ts`, and `mr_status.ts` (state/filter icons).
- Do not fetch MR discussions per list row; `useMRDiscussionStats` in `mr_discussions.ts` is for detail/side panel only. Metadata label is "Discussions" (`resolved/resolvable` only; not `user_notes_count`); no discussion count in list accessories.
- My Merge Requests and Reviews use GitLab API default order (`created_at` desc); no client-side re-sort.
- GitLab [Merge requests API](https://docs.gitlab.com/api/merge_requests/): list endpoints (`GET /merge_requests`, `GET /projects/:id/merge_requests`, `GET /groups/:id/merge_requests`) may return stale `merge_status` / `has_conflicts` unless `with_merge_status_recheck=true` (requests async recheck, not guaranteed; on GitLab 15.11+ may be ignored for users without Developer+ if `restrict_merge_status_recheck` is enabled). `with_merge_status_recheck` does not control `head_pipeline`; it only affects merge-status fields. Avoid `view=simple` when full MR fields are needed.
- Extension defaults in `getMergeRequests` / `getGroupMergeRequests`: `with_labels_details=true` and `with_merge_status_recheck=true` (callers can override).
- `MRListItem` must not call GitLab per row for approvals or full MR—only `useMRPipelines` when list payload has no `head_pipeline` (and not when `has_conflicts`). Discussions/full MR/approvals fetches belong in side panel (`MRListDetail`) or detail (`MRDetail`) only.
- MR list pipeline accessory: prefer `head_pipeline` from list (`getMRHeadPipelineStatus`, `parseHeadPipelineFromJson`); else `useMRPipelines(mr, { limit: 1 })` in `MRListItem`; `getCIJobStatusIcon`; hidden when `has_conflicts`. Full MR pipelines UI uses `useMRPipelines(mr, { all: true })` in `MRPipelineList` (separate cache key from list row).
- Author subtitle/tooltip email uses `User.public_email` when the API provides it.
- Import the `gitlab` client from `src/common.ts`, not `src/gitlabapi.ts`.
