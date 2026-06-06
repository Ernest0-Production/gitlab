import { Action, showToast, Toast, Form, Icon, popToRoot, Image, ActionPanel } from "@raycast/api";
import { Project } from "./gitlabapi";
import { gitlab } from "./common";
import { useState } from "react";
import { useCachedPromise } from "@raycast/utils";
import { getErrorMessage, projectIcon, showErrorToast, toFormValues } from "./utils";
import { useProject, useMilestones } from "./hooks";

interface IssueFormValues {
  project_id: number;
  title: string;
  description: string;
  assignee_ids: number[];
  labels: string[];
  milestone_id: number;
}

export default function CreateIssueFormRoot() {
  return <IssueForm />;
}

async function submit(values: IssueFormValues) {
  try {
    if (values.title === "") {
      throw Error("Please enter a title");
    }
    const val = toFormValues(values as unknown as Record<string, unknown>);
    console.log(val);
    await gitlab.createIssue(values.project_id, val);
    await showToast(Toast.Style.Success, "Issue created", "Issue creation successful");
    popToRoot();
  } catch (error) {
    await showErrorToast(getErrorMessage(error));
  }
}

function IssueForm() {
  const [selectedProject, setSelectedProject] = useState<string>();
  const {
    data: projects,
    error: errorProjects,
    isLoading: isLoadingProjects,
  } = useCachedPromise(async (): Promise<Project[]> => (await gitlab.getUserProjects({}, true)) || [], [], {
    onError: () => undefined,
  });
  const { projectinfo, errorProjectInfo, isLoadingProjectInfo } = useProject(selectedProject);
  const members = projectinfo?.members || [];
  const labels = projectinfo?.labels || [];

  let project: Project | undefined;
  if (selectedProject) {
    project = projects?.find((candidate) => candidate.id.toString() === selectedProject);
  }
  const { milestoneInfo, errorMilestoneInfo, isLoadingMilestoneInfo } = useMilestones(project?.group_id);

  const isLoading = isLoadingProjects || isLoadingProjectInfo || isLoadingMilestoneInfo;
  const error = (errorProjects ? getErrorMessage(errorProjects) : undefined) || errorProjectInfo || errorMilestoneInfo;

  if (error) {
    showErrorToast(error, "Cannot create Issue");
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Issue" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <ProjectDropdown projects={projects || []} setSelectedProject={setSelectedProject} value={selectedProject} />
      <Form.TextField id="title" title="Title" placeholder="Enter title" />
      <Form.TextArea id="description" title="Description" placeholder="Enter description" />
      <Form.TagPicker id="assignee_ids" title="Assignees" placeholder="Type or choose an assignee">
        {members.map((member) => (
          <Form.TagPicker.Item
            key={member.id.toString()}
            value={member.id.toString()}
            title={member.name || member.username}
            icon={{ source: member.avatar_url, mask: Image.Mask.Circle }}
          />
        ))}
      </Form.TagPicker>
      <Form.TagPicker id="labels" title="Labels" placeholder="Type or choose an label">
        {labels.map((label) => (
          <Form.TagPicker.Item
            key={label.name}
            value={label.name}
            title={label.name}
            icon={{ source: Icon.Circle, tintColor: label.color }}
          />
        ))}
      </Form.TagPicker>
      <Form.Dropdown id="milestone_id" title="Milestone">
        <Form.Dropdown.Item key="_empty" value="" title="-" />
        {projectinfo?.milestones?.map((milestone) => (
          <Form.Dropdown.Item key={milestone.id} value={milestone.id.toString()} title={milestone.title} />
        ))}
        {milestoneInfo?.map((milestone) => (
          <Form.Dropdown.Item key={milestone.id} value={milestone.id.toString()} title={milestone.title} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}

function ProjectDropdown(props: {
  projects: Project[];
  setSelectedProject: React.Dispatch<React.SetStateAction<string | undefined>>;
  value?: string;
}) {
  const projects = props.projects;
  return (
    <Form.Dropdown
      id="project_id"
      title="Project"
      value={props.value}
      storeValue={true}
      onChange={(val: string) => {
        props.setSelectedProject(val);
      }}
    >
      {projects?.map((project) => (
        <ProjectDropdownItem key={project.id} project={project} />
      ))}
    </Form.Dropdown>
  );
}

function ProjectDropdownItem(props: { project: Project }) {
  const project = props.project;
  return (
    <Form.Dropdown.Item value={project.id.toString()} title={project.name_with_namespace} icon={projectIcon(project)} />
  );
}
