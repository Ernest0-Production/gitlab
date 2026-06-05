import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../../common";
import { CommitStatus } from "./types";

export async function getCommitStatus(projectID: number, sha: string): Promise<CommitStatus | undefined> {
  const status: CommitStatus | undefined = await gitlab
    .fetch(`projects/${projectID}/repository/commits/${sha}/statuses`)
    .then((d) => {
      if (d && d.length > 0) {
        for (const s of d) {
          if (s.status !== "success") {
            return s;
          }
        }
        return d[0] as CommitStatus;
      }
      return undefined;
    });
  return status;
}

export function useCommitStatus(
  projectID: number,
  sha?: string,
): { commitStatus: CommitStatus | undefined; isLoading: boolean } {
  const { data, isLoading } = useCachedPromise(
    (pid: number, commitSha: string) => getCommitStatus(pid, commitSha),
    [projectID, sha ?? ""],
    { execute: !!sha },
  );
  return { commitStatus: data, isLoading };
}
