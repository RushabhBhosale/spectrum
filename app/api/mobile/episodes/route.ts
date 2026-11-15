import { MobileError, mobileFailure, mobileResponse, requireMobileSession } from '@/lib/mobile-auth';
import { episodeGuideFor } from '@/lib/episode-guide';
import { readStore } from '@/lib/store';
import { entryKey } from '@/lib/types';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireMobileSession(request, 'library:read');
    const id = new URL(request.url).searchParams.get('id');
    const store = await readStore();
    const title = store.titles.find((item) => entryKey(item) === id);
    if (!title) throw new MobileError(404, 'Title not found. Refresh your collection.');
    try { return mobileResponse(await episodeGuideFor(title, store.generated[id!])); }
    catch (error) { throw new MobileError(422, (error as Error).message); }
  } catch (error) { return mobileFailure(error); }
}
