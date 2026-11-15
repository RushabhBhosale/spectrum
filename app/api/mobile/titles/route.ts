import { MobileError, mobileBody, mobileFailure, mobileResponse, requireMobileSession } from '@/lib/mobile-auth';
import { mobileTitle, prepareMobileUpdate } from '@/lib/mobile-titles';
import { readStore, writeStore } from '@/lib/store';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireMobileSession(request, 'library:read');
    const store = await readStore();
    return mobileResponse({ collectionId: 'personal', titles: store.titles.map((entry) => mobileTitle(entry, store)), fetchedAt: Date.now() });
  } catch (error) { return mobileFailure(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireMobileSession(request, 'titles:update');
    const body = await mobileBody(request);
    if (Object.keys(body).some((key) => !['id', 'expectedRevision', 'changes'].includes(key))) throw new MobileError(400, 'Unsupported update fields.');
    const store = await readStore();
    const update = prepareMobileUpdate(store, body.id, body.expectedRevision, body.changes);
    try { await writeStore(update.store); }
    catch (error) {
      if ((error as Error).message.includes('changed while you were editing')) throw new MobileError(409, 'The collection changed. Refresh and review again.');
      throw error;
    }
    const saved = update.store.titles.find((entry) => `${entry.type}:${entry.title}` === update.key)!;
    return mobileResponse({ title: mobileTitle(saved, update.store), savedAt: Date.now() });
  } catch (error) { return mobileFailure(error); }
}
