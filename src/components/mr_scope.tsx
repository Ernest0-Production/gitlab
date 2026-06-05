import { Action, ActionPanel, Icon, Image } from "@raycast/api";
import { MRScope } from "./mr";

const MR_SCOPE_OPTIONS: { value: MRScope; title: string }[] = [
  { value: MRScope.all, title: "All" },
  { value: MRScope.created_by_me, title: "Created by me" },
  { value: MRScope.assigned_to_me, title: "Assigned to me" },
  { value: MRScope.reviews_for_me, title: "Reviews for me" },
];

function mrScopeSemanticIcon(scope: MRScope): Image.ImageLike {
  switch (scope) {
    case MRScope.created_by_me:
      return Icon.Pencil;
    case MRScope.assigned_to_me:
      return Icon.Person;
    case MRScope.reviews_for_me:
      return Icon.Eye;
    default:
      return Icon.List;
  }
}

function mrScopeIcon(scope: MRScope, isActive: boolean): Image.ImageLike {
  if (isActive) {
    return Icon.Checkmark;
  }
  return mrScopeSemanticIcon(scope);
}

export function mergeRequestScopeSubmenu(scope: MRScope, onSelectScope: (scope: MRScope) => void) {
  return (
    <ActionPanel.Submenu title="Filter Scope" shortcut={{ modifiers: ["cmd"], key: "f" }} icon={Icon.Filter}>
      {MR_SCOPE_OPTIONS.map(({ value, title }) => (
        <Action
          key={value}
          title={title}
          icon={mrScopeIcon(value, scope === value)}
          autoFocus={scope === value}
          onAction={() => onSelectScope(value)}
        />
      ))}
    </ActionPanel.Submenu>
  );
}
