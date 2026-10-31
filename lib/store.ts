import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gitHub, GENERATED_PATH, serialiseGenerated, serialiseTitles, TITLES_PATH } from '@/scripts/github.mjs';
import type { Entry, Generated } from './types';

export type Store = { titles: Entry[]; generated: Record<string, Generated> };

const remote = () => {
  const { GITHUB_TOKEN: token, GITHUB_REPO: repo, GITHUB_BRANCH: branch } = process.env;
  return token && repo ? gitHub({ token, repo, branch: branch || undefined }) : null;
};

const onDisk = (file: string) => path.join(process.cwd(), 'data', path.basename(file));

export async function readStore(): Promise<Store> {
  const github = remote();
  if (github) return github.read();
  const [titles, generated] = await Promise.all([readFile(onDisk(TITLES_PATH), 'utf8'), readFile(onDisk(GENERATED_PATH), 'utf8')]);
  return { titles: JSON.parse(titles), generated: JSON.parse(generated) };
}

/** Saves to the repo when GitHub is set up, otherwise to the local data files. */
export async function writeStore(store: Store, message: string) {
  const github = remote();
  if (github) {
    await github.write(store, message);
    return 'live' as const;
  }
  if (process.env.VERCEL) throw new Error('Saving needs GITHUB_TOKEN and GITHUB_REPO on Vercel');
  await Promise.all([
    writeFile(onDisk(TITLES_PATH), serialiseTitles(store.titles)),
    writeFile(onDisk(GENERATED_PATH), serialiseGenerated(store.generated)),
  ]);
  return 'local' as const;
}
