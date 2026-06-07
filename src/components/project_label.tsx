import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../common";
import { Label, Project, searchData } from "../gitlabapi";
import { LabelList } from "./label";
import { getErrorMessage, showErrorToast } from "../utils";

export function ProjectLabelList(props: { project: Project; navigationTitle?: string }) {
  const [searchText, setSearchText] = useState<string>();
  const { data, isLoading } = useCachedPromise(
    (projectId: number) => gitlab.getProjectLabels(projectId),
    [props.project.id],
    {
      keepPreviousData: true,
    },
  );

  return (
    <LabelList
      labels={searchData<Label[]>(data ?? [], { search: searchText || "", keys: ["name"], limit: 50 })}
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
      navigationTitle={props.navigationTitle}
    />
  );
}
