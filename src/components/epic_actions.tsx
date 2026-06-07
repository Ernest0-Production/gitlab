import { Action, Color, Keyboard, showToast, Toast } from "@raycast/api";
import { gitlab } from "../common";
import { Epic } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { getErrorMessage, showErrorToast } from "../utils";

export function CreateEpicTodoAction(props: { epic: Epic; shortcut?: Keyboard.Shortcut }) {
  async function handleAction() {
    try {
      await gitlab.post(`groups/${props.epic.group_id}/epics/${props.epic.iid}/todo`);
      showToast(Toast.Style.Success, "To do created");
    } catch (error) {
      showErrorToast(getErrorMessage(error), "Failed to add as to do");
    }
  }
  if (props.epic.state === "opened") {
    return (
      <Action
        title="Add a To-Do"
        shortcut={props.shortcut}
        icon={{ source: GitLabIcons.todo, tintColor: Color.PrimaryText }}
        onAction={handleAction}
      />
    );
  } else {
    return null;
  }
}
