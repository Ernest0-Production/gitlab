import { Action, ActionPanel, Color, Detail, Icon, List } from "@raycast/api";
import { Label } from "../gitlabapi";
import { GitLabIcons } from "../icons";

export function LabelDetail(props: { label: Label }) {
  const label = props.label;
  let md = `## Color\n${label.color}`;
  if (label.description) {
    md += `\n## Description\n${label.description}`;
  }
  return <Detail markdown={md} />;
}

export function LabelListItem(props: { label: Label }) {
  const label = props.label;
  const accessoryTitle = Object.keys(label).includes("subscribed") && label.subscribed ? "subscribed" : undefined;
  return (
    <List.Item
      key={label.id.toString()}
      title={label.name}
      icon={{ source: Icon.Circle, tintColor: label.color }}
      accessories={[{ text: accessoryTitle }]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Show Details"
            target={<LabelDetail label={label} />}
            icon={{ source: GitLabIcons.show_details, tintColor: Color.PrimaryText }}
          />
          <Action.CopyToClipboard title="Copy Color" content={label.color} />
        </ActionPanel>
      }
    />
  );
}

export function LabelList(props: {
  labels: Label[];
  title?: string | undefined;
  onSearchTextChange?: ((text: string) => void) | undefined;
  isLoading?: boolean | undefined;
  throttle?: boolean | undefined;
  navigationTitle?: string;
}) {
  const labels = props.labels.filter((label) => label && label.id);
  return (
    <List
      searchBarPlaceholder="Search labels by name"
      onSearchTextChange={props.onSearchTextChange}
      isLoading={props.isLoading}
      throttle={props.throttle}
      navigationTitle={props.navigationTitle}
    >
      <List.Section title={props.title}>
        {labels.map((label) => (
          <LabelListItem key={label.id.toString()} label={label} />
        ))}
      </List.Section>
    </List>
  );
}
