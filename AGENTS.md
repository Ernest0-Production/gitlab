## Learned User Preferences

- When changing this Raycast GitLab extension, preserve existing code style and structure; do not refactor unrelated patterns or drift from local conventions.
- Run requested terminal, lint, and Raycast dev/debug commands yourself when asked instead of only describing them.

## Learned Workspace Facts

- Search Merge Requests UI lives in `src/components/mr_search.tsx` (entry `src/mr_search.tsx`); the AI tool is `src/tools/search-merge-requests.ts` and is separate from the List UI.
- Search Merge Requests uses `MyProjectsDropdown` with `includeAllItem={false}`: only concrete repositories, no "All Projects"; a project must be selected before MRs load.
- Search Merge Requests groups MRs into "Created by me" (section hidden when empty) and "Other".
- `MyProjectsDropdown` in `src/components/project.tsx` supports `includeAllItem` (default `true`); My Merge Requests and Reviews keep "All Projects".
- MR list metadata panel uses `useMRListDetails()` and `MRListDetailsToggleAction` (shortcut ⌘⇧D); the former `listdetails` preference was removed from `package.json`.
- Shared MR UI is split across `mr.tsx`, `mr_actions.tsx`, `mr_metadata.tsx` (side panel metadata), `mr_discussions.ts`, and `mr_status.ts` (state/filter icons).
- Do not fetch MR discussions per list row; `useMRDiscussionStats` in `mr_discussions.ts` is for detail/side panel only (list rows use `user_notes_count`).
- MR lists use GitLab API order (`created_at` desc); Search MR only partitions into "Created by me" / "Other" without re-sorting.
- Author subtitle/tooltip email uses `User.public_email` when the API provides it.
- Import the `gitlab` client from `src/common.ts`, not `src/gitlabapi.ts`.
