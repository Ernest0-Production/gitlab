import { Action, ActionPanel, Color, Detail, Icon, List } from "@raycast/api";
import { Label } from "../gitlabapi";
import { GitLabIcons } from "../icons";

export function LabelDetail(props: { label: Label }) {
  let md = `## Color\n${props.label.color}`;
  if (props.label.description) {
    md += `\n## Description\n${props.label.description}`;
  }
  return <Detail markdown={md} />;
}

export function LabelListItem(props: { label: Label }) {
  return (
    <List.Item
      key={props.label.id.toString()}
      title={props.label.name}
      icon={{ source: Icon.Circle, tintColor: props.label.color }}
      accessories={[
        {
          text: Object.keys(props.label).includes("subscribed") && props.label.subscribed ? "subscribed" : undefined,
        },
      ]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Show Details"
            target={<LabelDetail label={props.label} />}
            icon={{ source: GitLabIcons.show_details, tintColor: Color.PrimaryText }}
          />
          <Action.CopyToClipboard title="Copy Color" content={props.label.color} />
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
  return (
    <List
      searchBarPlaceholder="Search labels by name"
      onSearchTextChange={props.onSearchTextChange}
      isLoading={props.isLoading}
      throttle={props.throttle}
      navigationTitle={props.navigationTitle}
    >
      <List.Section title={props.title}>
        {props.labels
          .filter((label) => label && label.id)
          .map((label) => (
            <LabelListItem key={label.id.toString()} label={label} />
          ))}
      </List.Section>
    </List>
  );
}
