import { environment } from "@raycast/api";
import path from "path/posix";
import * as fs from "fs/promises";
import { constants } from "fs";
import { currentSeconds } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

const logCaching = false;

export function cacheLog(message?: any, ...optionalParams: any[]): void {
  if (logCaching) {
    console.log(message, ...optionalParams);
  }
}

export function getLargeCacheDirectory(): string {
  const sp = environment.supportPath;
  const cacheDir = path.join(sp, "cache");
  return cacheDir;
}

export async function getCacheFilepath(key: string, ensureDirectory = false): Promise<string> {
  const cacheDir = getLargeCacheDirectory();
  if (ensureDirectory) {
    cacheLog(`create cache directoy '${cacheDir}'`);
    await fs.mkdir(cacheDir, { recursive: true });
  }
  const cacheFilePath = path.join(cacheDir, `${key}.json`);
  return cacheFilePath;
}

export async function getLargeCacheObject(key: string, seconds: number): Promise<any> {
  cacheLog("GET cache");
  let cacheFilePath = undefined;
  try {
    cacheFilePath = await getCacheFilepath(key);
    await fs.access(cacheFilePath, constants.R_OK);
    const jsontext = await fs.readFile(cacheFilePath, "utf-8");
    const cache_data = JSON.parse(jsontext);
    if (!cache_data) {
      return undefined;
    }
    const timestamp = currentSeconds();
    const delta = timestamp - cache_data.timestamp;
    if (delta > seconds) {
      return undefined;
    } else {
      return cache_data.payload;
    }
  } catch (e) {
    cacheLog(`could not access cache file or not exists '${cacheFilePath}' ${e}`);
  }
  return undefined;
}

export async function setLargeCacheObject(key: string, payload: any): Promise<void> {
  let cacheFilePath = undefined;
  try {
    cacheFilePath = await getCacheFilepath(key, true);
    cacheLog(`set cache object '${key}'`);
    const cache_data = {
      timestamp: currentSeconds(),
      payload: payload,
    };
    const text = JSON.stringify(cache_data);
    await fs.writeFile(cacheFilePath, text, "utf-8");
  } catch (e) {
    cacheLog(e);
    cacheLog(`could not write cache file '${cacheFilePath}'`);
  }
}

export async function receiveLargeCachedObject(key: string, fn: () => Promise<any>): Promise<any> {
  let data = await getLargeCacheObject(key, 5 * 60);
  if (!data) {
    data = await fn();
    await setLargeCacheObject(key, data);
    return data;
  } else {
    cacheLog("use cached data");
    return data;
  }
}
