import { Action, ActionPanel, Icon } from "@raycast/api";
import { MRScope, MRState } from "./mr";
import { MergeRequestScopeSubmenu } from "./mr_scope";
import { mrStateFilterIcon } from "./mr_status";

const MR_STATE_FILTERS: { state: MRState; title: string }[] = [
  { state: MRState.opened, title: "Open" },
  { state: MRState.merged, title: "Merged" },
  { state: MRState.closed, title: "Closed" },
];

function MergeRequestStatusSubmenu(props: { state: MRState; onSelect: (state: MRState) => void }) {
  return (
    <ActionPanel.Submenu title="Status" icon={Icon.Circle}>
      <ActionPanel.Section>
        <Action
          title="All"
          icon={mrStateFilterIcon(MRState.all, props.state === MRState.all)}
          autoFocus={props.state === MRState.all}
          onAction={() => props.onSelect(MRState.all)}
        />
      </ActionPanel.Section>
      <ActionPanel.Section>
        {MR_STATE_FILTERS.map(({ state, title }) => (
          <Action
            key={state}
            title={title}
            icon={mrStateFilterIcon(state, props.state === state)}
            autoFocus={props.state === state}
            onAction={() => props.onSelect(state)}
          />
        ))}
      </ActionPanel.Section>
    </ActionPanel.Submenu>
  );
}

export function MergeRequestFilterSubmenu(props: {
  scope: MRScope;
  onSelectScope: (scope: MRScope) => void;
  state: MRState;
  onSelectState: (state: MRState) => void;
}) {
  return (
    <ActionPanel.Submenu title="Filter" shortcut={{ modifiers: ["cmd"], key: "f" }} icon={Icon.Filter}>
      <MergeRequestScopeSubmenu scope={props.scope} onSelect={props.onSelectScope} />
      <MergeRequestStatusSubmenu state={props.state} onSelect={props.onSelectState} />
    </ActionPanel.Submenu>
  );
}
