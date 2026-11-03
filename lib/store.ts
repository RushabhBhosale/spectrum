import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { mongoStore } from '@/scripts/mongo-store.mjs';
import type { Entry, Generated } from './types';

export type Store = { titles: Entry[]; generated: Record<string, Generated>; version?: number };
const dataPath = (file: string) => path.join(process.cwd(), 'data', file);
let connection: { uri: string; client: MongoClient } | undefined;

async function collection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  if (!connection || connection.uri !== uri) connection = { uri, client: new MongoClient(uri) };
  return connection.client.db(process.env.MONGODB_DB || 'spectrum').collection('collection');
}

async function initialStore(): Promise<Store> {
  const [titles, generated] = await Promise.all([readFile(dataPath('titles.json'), 'utf8'), readFile(dataPath('generated.json'), 'utf8')]);
  return { titles: JSON.parse(titles), generated: JSON.parse(generated) };
}

export async function readStore(): Promise<Store> {
  const db = await collection();
  return db ? mongoStore(db).read(initialStore) : initialStore();
}

export async function writeStore(store: Store) {
  const db = await collection();
  if (db) {
    await mongoStore(db).write({ ...store, version: store.version ?? 0 });
    return;
  }
  if (process.env.VERCEL) throw new Error('Set MONGODB_URI to save titles on Vercel.');
  await Promise.all([
    writeFile(dataPath('titles.json'), '[\n' + store.titles.map((title) => '  ' + JSON.stringify(title)).join(',\n') + '\n]\n'),
    writeFile(dataPath('generated.json'), JSON.stringify(store.generated, null, 2) + '\n'),
  ]);
}
