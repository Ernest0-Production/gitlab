import { gql } from "@apollo/client";
import { getGitLabGQL, gitlab } from "../common";
import { MRDiscussion, MRDiscussionNote, User } from "../gitlabapi";
import { getIdFromGqlId } from "../utils";

export const MR_DISCUSSIONS_PAGE_SIZE = 20;

/* eslint-disable @typescript-eslint/no-explicit-any */

const DISCUSSION_NOTE_FIELDS = gql`
  fragment DiscussionNoteFields on Note {
    id
    body
    createdAt
    system
    resolvable
    resolved
    url
    position {
      filePath
      newPath
      oldPath
      newLine
      oldLine
    }
    author {
      username
      name
      avatarUrl
    }
  }
`;

const MR_DISCUSSIONS = gql`
  ${DISCUSSION_NOTE_FIELDS}
  query MergeRequestDiscussions($fullPath: ID!, $iid: String!, $first: Int!, $after: String) {
    project(fullPath: $fullPath) {
      mergeRequest(iid: $iid) {
        id
        discussions(first: $first, after: $after) {
          nodes {
            id
            resolvable
            resolved
            notes(first: 100) {
              nodes {
                ...DiscussionNoteFields
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const CREATE_NOTE = gql`
  mutation CreateNote($input: CreateNoteInput!) {
    createNote(input: $input) {
      errors
    }
  }
`;

interface GqlDiscussionNoteNode {
  id: string;
  body: string;
  createdAt: string;
  system: boolean;
  resolvable: boolean;
  resolved: boolean;
  url?: string | null;
  position?: {
    filePath?: string | null;
    newPath?: string | null;
    oldPath?: string | null;
    newLine?: number | null;
    oldLine?: number | null;
  } | null;
  author?: {
    username?: string | null;
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
}

interface GqlDiscussionNode {
  id: string;
  resolvable: boolean;
  resolved: boolean;
  notes: { nodes: GqlDiscussionNoteNode[] };
}

interface GqlDiscussionConnection {
  nodes: GqlDiscussionNode[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string | null;
  };
}

const endCursorsByCacheKey = new Map<string, string[]>();

export function resetMRDiscussionsGqlCursors(cacheKey: string): void {
  endCursorsByCacheKey.delete(cacheKey);
}

function resolveAvatarUrl(avatarUrl: string | null | undefined): string {
  if (!avatarUrl) {
    return "";
  }
  if (/^https?:\/\//i.test(avatarUrl)) {
    return avatarUrl;
  }
  return gitlab.joinUrl(avatarUrl);
}

function gqlPositionToPosition(position?: GqlDiscussionNoteNode["position"]): MRDiscussionNote["position"] {
  if (!position) {
    return undefined;
  }
  const filePath = position.newPath ?? position.oldPath ?? position.filePath;
  if (!filePath) {
    return undefined;
  }
  const line = position.newLine ?? position.oldLine ?? undefined;
  return { file_path: filePath, line };
}

function gqlDiscussionNoteToNote(node: GqlDiscussionNoteNode): MRDiscussionNote {
  const author = node.author
    ? ({
        id: 0,
        name: node.author.name ?? "",
        username: node.author.username ?? "",
        avatar_url: resolveAvatarUrl(node.author.avatarUrl),
        web_url: "",
        state: "",
        public_email: "",
      } as User)
    : undefined;
  return {
    id: getIdFromGqlId(node.id),
    body: node.body,
    author,
    created_at: node.createdAt,
    web_url: node.url ?? "",
    position: gqlPositionToPosition(node.position),
    resolvable: node.resolvable,
    resolved: node.resolved,
    system: node.system,
  };
}

function gqlDiscussionToDiscussion(node: GqlDiscussionNode): MRDiscussion {
  return {
    id: node.id,
    resolvable: node.resolvable,
    resolved: node.resolved,
    notes: node.notes.nodes.map(gqlDiscussionNoteToNote),
  };
}

async function queryMRDiscussionsConnection(
  projectFullPath: string,
  mrIID: number,
  variables: { first: number; after?: string },
): Promise<GqlDiscussionConnection> {
  const response = await getGitLabGQL().client.query({
    query: MR_DISCUSSIONS,
    variables: {
      fullPath: projectFullPath,
      iid: `${mrIID}`,
      first: variables.first,
      after: variables.after,
    },
  });
  const connection = response.data?.project?.mergeRequest?.discussions as GqlDiscussionConnection | undefined;
  if (!connection) {
    throw new Error("Could not load merge request discussions");
  }
  return connection;
}

async function fetchDiscussionGqlPage(options: {
  cacheKey: string;
  page: number;
  projectFullPath: string;
  mrIID: number;
}): Promise<{ discussions: MRDiscussion[]; hasMore: boolean }> {
  const { cacheKey, page, projectFullPath, mrIID } = options;

  if (!endCursorsByCacheKey.has(cacheKey)) {
    endCursorsByCacheKey.set(cacheKey, []);
  }
  const cursors = endCursorsByCacheKey.get(cacheKey)!;

  if (page === 0) {
    cursors.length = 0;
  }

  if (page > 0 && cursors.length < page) {
    for (let index = cursors.length; index < page; index += 1) {
      const after = index === 0 ? undefined : cursors[index - 1];
      const connection = await queryMRDiscussionsConnection(projectFullPath, mrIID, {
        first: MR_DISCUSSIONS_PAGE_SIZE,
        after,
      });
      cursors[index] = connection.pageInfo.endCursor ?? "";
      if (!connection.pageInfo.hasNextPage) {
        return { discussions: [], hasMore: false };
      }
    }
  }

  const after = page > 0 ? cursors[page - 1] : undefined;
  const connection = await queryMRDiscussionsConnection(projectFullPath, mrIID, {
    first: MR_DISCUSSIONS_PAGE_SIZE,
    after,
  });
  cursors[page] = connection.pageInfo.endCursor ?? "";

  return {
    discussions: connection.nodes.map(gqlDiscussionToDiscussion),
    hasMore: connection.pageInfo.hasNextPage,
  };
}

export async function fetchMRDiscussionsGqlPage(options: {
  cacheKey: string;
  page: number;
  projectFullPath: string;
  mrIID: number;
}): Promise<{ discussions: MRDiscussion[]; hasMore: boolean }> {
  return fetchDiscussionGqlPage(options);
}

export async function createMRDiscussionNoteGql(options: {
  noteableId: string;
  discussionId: string;
  body: string;
}): Promise<void> {
  const response = await getGitLabGQL().client.mutate({
    mutation: CREATE_NOTE,
    variables: {
      input: {
        noteableId: options.noteableId,
        discussionId: options.discussionId,
        body: options.body,
      },
    },
  });
  const errors = response.data?.createNote?.errors as string[] | undefined;
  if (errors && errors.length > 0) {
    throw new Error(errors.join(", "));
  }
}
