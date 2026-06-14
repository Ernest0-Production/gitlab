import { Action, ActionPanel, Color, Form, Icon, Image, List, showToast, Toast, useNavigation } from "@raycast/api";
import { showFailureToast, usePromise } from "@raycast/utils";
import { MRDiscussion, MRDiscussionNote, MergeRequest } from "../gitlabapi";
import { formatDateTime, optimizeMarkdownText, shortify } from "../utils";
import { GitLabOpenInBrowserAction } from "./actions";
import { isDiscussionResolved } from "./mr_discussions";
import { createMRDiscussionNoteGql, fetchMRDiscussionsGqlPage } from "./mr_discussions_gql";

function discussionNotes(discussion: MRDiscussion): MRDiscussionNote[] {
  return (discussion.notes ?? []).filter((note) => !note.system);
}

function firstDiscussionNote(discussion: MRDiscussion): MRDiscussionNote | undefined {
  return discussionNotes(discussion)[0];
}

function discussionUrl(discussion: MRDiscussion, mr: MergeRequest): string {
  return firstDiscussionNote(discussion)?.web_url || mr.web_url;
}

function discussionTitle(discussion: MRDiscussion): string {
  return shortify(firstDiscussionNote(discussion)?.body.replace(/\s+/g, " ").trim() || "Discussion", 100);
}

function discussionSubtitle(discussion: MRDiscussion): string | undefined {
  const position = firstDiscussionNote(discussion)?.position;
  if (!position?.file_path) {
    return undefined;
  }
  return position.line ? `${position.file_path}:${position.line}` : position.file_path;
}

function quoteMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function discussionPositionMarkdown(note: MRDiscussionNote, mr: MergeRequest): string | undefined {
  if (!note.position?.file_path) {
    return undefined;
  }
  const label = note.position.line ? `${note.position.file_path}:${note.position.line}` : note.position.file_path;
  const url = note.web_url || mr.web_url;
  return `[${label}](${url})`;
}

function discussionMarkdown(discussion: MRDiscussion, mr: MergeRequest): string {
  const notes = discussionNotes(discussion);
  const blocks: string[] = [];
  const positionLine = notes[0] ? discussionPositionMarkdown(notes[0], mr) : undefined;
  if (positionLine) {
    blocks.push(positionLine);
  }
  for (const note of notes) {
    blocks.push(
      [
        `**${note.author?.username ?? "Unknown"}** (*${formatDateTime(note.created_at)}*):`,
        quoteMarkdown(optimizeMarkdownText(note.body, mr.project_web_url)),
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

function MRDiscussionReplyForm(props: { mr: MergeRequest; discussion: MRDiscussion; onReply: () => void }) {
  const { pop } = useNavigation();

  async function submit(values: { body: string }) {
    if (!values.body.trim()) {
      throw Error("Please enter a reply");
    }
    try {
      await showToast({ style: Toast.Style.Animated, title: "Adding reply..." });
      if (!props.mr.gql_id) {
        throw Error("Merge request ID is missing");
      }
      await createMRDiscussionNoteGql({
        noteableId: props.mr.gql_id,
        discussionId: props.discussion.id,
        body: values.body,
      });
      showToast(Toast.Style.Success, "Reply added");
      props.onReply();
      pop();
    } catch (error) {
      showFailureToast(error, { title: "Failed to add reply" });
    }
  }

  return (
    <Form
      navigationTitle="Reply to Discussion"
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Reply" onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="body" title="Reply" placeholder="Enter reply" enableMarkdown />
    </Form>
  );
}

function MRDiscussionListItem(props: { mr: MergeRequest; discussion: MRDiscussion; onReply: () => void }) {
  const firstNote = firstDiscussionNote(props.discussion);

  return (
    <List.Item
      id={props.discussion.id}
      title={discussionTitle(props.discussion)}
      subtitle={discussionSubtitle(props.discussion)}
      icon={{ source: firstNote?.author?.avatar_url || Icon.SpeechBubble, mask: Image.Mask.Circle }}
      accessories={firstNote?.author ? [{ tooltip: firstNote.author.name }] : []}
      detail={<List.Item.Detail markdown={discussionMarkdown(props.discussion, props.mr)} />}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.Push
              title="Reply"
              icon={{ source: Icon.Message, tintColor: Color.PrimaryText }}
              target={<MRDiscussionReplyForm mr={props.mr} discussion={props.discussion} onReply={props.onReply} />}
            />
            <GitLabOpenInBrowserAction url={discussionUrl(props.discussion, props.mr)} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export function MRDiscussionList(props: { mr: MergeRequest }) {
  const { data, isLoading, revalidate, pagination } = usePromise(
    (projectFullPath: string, mrIID: number) => async (options: { page: number }) => {
      const { discussions, hasMore } = await fetchMRDiscussionsGqlPage({
        cacheKey: `mr_discussions_${projectFullPath}_${mrIID}`,
        page: options.page,
        projectFullPath,
        mrIID,
      });
      return { data: discussions, hasMore };
    },
    [props.mr.project_full_path, props.mr.iid],
  );
  const discussions = (data ?? []).filter((discussion) => discussionNotes(discussion).length > 0);
  const unresolvedDiscussions = discussions.filter((discussion) => !isDiscussionResolved(discussion));
  const resolvedDiscussions = discussions.filter((discussion) => isDiscussionResolved(discussion));

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      pagination={pagination}
      navigationTitle={`Discussions ${props.mr.reference_full}`}
    >
      <List.Section title="Unresolved Discussions" subtitle={unresolvedDiscussions.length.toString()}>
        {unresolvedDiscussions.map((discussion) => (
          <MRDiscussionListItem key={discussion.id} mr={props.mr} discussion={discussion} onReply={revalidate} />
        ))}
      </List.Section>
      <List.Section title="Resolved Discussions" subtitle={resolvedDiscussions.length.toString()}>
        {resolvedDiscussions.map((discussion) => (
          <MRDiscussionListItem key={discussion.id} mr={props.mr} discussion={discussion} onReply={revalidate} />
        ))}
      </List.Section>
      <List.EmptyView title="No Discussions" />
    </List>
  );
}
