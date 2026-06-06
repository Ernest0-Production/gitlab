import { Cache } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { gitlab } from "../common";

const avatarCache = new Cache({ namespace: "user-avatars" });

// Tracks in-flight avatar requests per normalized email so that concurrent
// callers for the same email reuse a single network request instead of each
// firing their own. Resolved entries are removed once the promise settles.
const activeAvatarLoads = new Map<string, Promise<string | undefined>>();

const avatarSize = 64;

async function fetchAvatarUrl(email: string): Promise<string | undefined> {
  const data = await gitlab.fetch("avatar", { email, size: `${avatarSize}` });
  const url = data?.avatar_url as string | undefined;
  return url && url.length > 0 ? url : undefined;
}

async function resolveAvatarUrl(rawEmail: string): Promise<string | undefined> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return undefined;
  }
  const key = `avatar_${email}`;

  // 1. An identical request is already in flight: await the same promise.
  const active = activeAvatarLoads.get(email);
  if (active) {
    return active;
  }

  // 2. Already resolved earlier: serve from cache (empty string means "no avatar").
  const cached = avatarCache.get(key);
  if (cached !== undefined) {
    return cached.length > 0 ? cached : undefined;
  }

  // 3. Nothing cached and nothing in flight: start a single shared request.
  const task = fetchAvatarUrl(email)
    .then((url) => {
      avatarCache.set(key, url ?? "");
      return url;
    })
    .finally(() => {
      activeAvatarLoads.delete(email);
    });

  activeAvatarLoads.set(email, task);
  return task;
}

export function useUserAvatar(email?: string): { avatarUrl?: string; isLoading: boolean } {
  const { data, isLoading } = useCachedPromise((avatarEmail: string) => resolveAvatarUrl(avatarEmail), [email ?? ""], {
    execute: !!email,
  });
  return { avatarUrl: data, isLoading };
}
