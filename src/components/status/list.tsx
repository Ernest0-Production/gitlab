import { ActionPanel, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../../common";
import { Status } from "../../gitlabapi";
import { formatDate, getErrorMessage, showErrorToast } from "../../utils";
import { useEffect, useState } from "react";
import { clearDurationText, emojiSymbol } from "./utils";
import { usePresets } from "./presets";
import {
  StatusClearCurrentAction,
  StatusPresetCreateAction,
  StatusPresetDeleteAction,
  StatusPresetEditAction,
  StatusPresetFactoryResetAction,
  StatusPresetMoveDownAction,
  StatusPresetMoveUpAction,
  StatusPresetSetAction,
  StatusPresetSetWithDurationAction,
  StatusSetCustomAction,
} from "./actions";

export default function StatusList() {
  const { data, error, isLoading } = useCachedPromise(() => gitlab.getUserStatus(), [], {
    onError: () => undefined,
  });
  if (error) {
    showErrorToast(getErrorMessage(error), "Could not fetch Status");
  }
  const [currentStatus, setCurrentStatus] = useState<Status | undefined>(data);
  useEffect(() => {
    setCurrentStatus(data);
  }, [data]);

  const { presets, setPresets } = usePresets();
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <List isLoading={isLoading} selectedItemId={selectedId}>
      <List.Section title="Current Status">
        <StatusCurrentListItem
          status={currentStatus}
          presets={presets}
          setPresets={setPresets}
          setCurrentStatus={setCurrentStatus}
        />
      </List.Section>
      <List.Section title="Presets">
        {presets.map((preset, index) => (
          <StatusPresetListItem
            key={`${preset.message}_${preset.emoji}_${index}`}
            status={preset}
            presets={presets}
            setPresets={setPresets}
            index={index}
            setCurrentStatus={setCurrentStatus}
            setSelectedId={setSelectedId}
          />
        ))}
      </List.Section>
    </List>
  );
}

function StatusCurrentListItem(props: {
  status: Status | undefined;
  presets: Status[];
  setPresets: React.Dispatch<React.SetStateAction<Status[]>>;
  setCurrentStatus: React.Dispatch<React.SetStateAction<Status | undefined>>;
}) {
  const status = props.status;
  const presets = props.presets;
  const setPresets = props.setPresets;
  let emojiIcon: string | undefined = undefined;

  let durationText: string | undefined = undefined;
  if (status && status.clear_status_at !== undefined && status.clear_status_at instanceof Date) {
    durationText = `Clears ${formatDate(status.clear_status_at)}`;
  }
  const setNoStatus = () => {
    emojiIcon = "🗨️";
    title = "No Status";
    durationText = "";
  };
  let title = "";
  if (status) {
    if (!status.emoji && !status.message) {
      setNoStatus();
    } else {
      emojiIcon = emojiSymbol(status.emoji);
      title = status.message ? status.message : "";
      if (durationText === undefined) {
        durationText = "Don't clear";
      }
    }
  }
  return (
    <List.Item
      title={title}
      icon={emojiIcon}
      subtitle={durationText}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <StatusClearCurrentAction status={status} setCurrentStatus={props.setCurrentStatus} />
            <StatusSetCustomAction setCurrentStatus={props.setCurrentStatus} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <StatusPresetCreateAction presets={presets} setPresets={setPresets} />
            <StatusPresetFactoryResetAction setPresets={setPresets} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export function StatusPresetListItem(props: {
  status: Status;
  presets: Status[];
  index: number;
  setPresets: React.Dispatch<React.SetStateAction<Status[]>>;
  setCurrentStatus: React.Dispatch<React.SetStateAction<Status | undefined>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | undefined>>;
}) {
  const status = props.status;
  const presets = props.presets || [];
  return (
    <List.Item
      id={`preset_${props.index}`}
      title={status.message}
      icon={emojiSymbol(status.emoji)}
      subtitle={clearDurationText(status.clear_status_after)}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <StatusPresetSetAction status={status} setCurrentStatus={props.setCurrentStatus} />
            <StatusPresetSetWithDurationAction status={status} setCurrentStatus={props.setCurrentStatus} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <StatusPresetEditAction
              status={status}
              presets={presets}
              index={props.index}
              setPresets={props.setPresets}
            />
            <StatusPresetDeleteAction presets={presets} index={props.index} setPresets={props.setPresets} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <StatusPresetCreateAction presets={presets} setPresets={props.setPresets} />
            <StatusSetCustomAction setCurrentStatus={props.setCurrentStatus} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <StatusPresetMoveUpAction
              presets={presets}
              setPresets={props.setPresets}
              index={props.index}
              setSelectedId={props.setSelectedId}
            />
            <StatusPresetMoveDownAction
              presets={presets}
              setPresets={props.setPresets}
              index={props.index}
              setSelectedId={props.setSelectedId}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <StatusPresetFactoryResetAction setPresets={props.setPresets} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
