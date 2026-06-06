import { List, getPreferenceValues } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { gitlab } from "../common";
import { Project } from "../gitlabapi";
import { getErrorMessage, showErrorToast } from "../utils";
import { ProjectListEmptyView, ProjectListItem, ProjectScope } from "./project";

export function ProjectSearchList() {
  const [searchText, setSearchText] = useState<string>();
  const [scope, setScope] = useState<string>(ProjectScope.membership);
  const { projects, error, isLoading } = useSearch(searchText, scope);

  if (error) {
    showErrorToast(error, "Cannot search Project");
  }

  return (
    <List
      searchBarPlaceholder="Filter Projects by Name..."
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
      searchBarAccessory={
        <List.Dropdown tooltip="Scope" onChange={setScope} storeValue>
          <List.Dropdown.Item title="My Projects" value={ProjectScope.membership} />
          <List.Dropdown.Item title="All" value={ProjectScope.all} />
        </List.Dropdown>
      }
    >
      <List.Section title="Projects" subtitle={`${projects?.length}`}>
        {projects?.map((project) => (
          <ProjectListItem key={project.id} project={project} />
        ))}
      </List.Section>
      <ProjectListEmptyView />
    </List>
  );
}

export function useSearch(
  query: string | undefined,
  scope: string,
): {
  projects?: Project[];
  error?: string;
  isLoading: boolean;
} {
  const active = (getPreferenceValues().active as boolean) || false;
  const { data, error, isLoading } = usePromise(
    (searchQuery: string, projectScope: string, isActive: boolean) => {
      const membership = projectScope === ProjectScope.membership ? "true" : "false";
      return gitlab.getProjects({ searchText: searchQuery, searchIn: "title", membership, active: isActive });
    },
    [query ?? "", scope, active],
    // The error is surfaced via `error` and toasted by the caller in render.
    { onError: () => undefined },
  );
  return { projects: data, error: error ? getErrorMessage(error) : undefined, isLoading };
}
