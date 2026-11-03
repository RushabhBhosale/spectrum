import Site from '@/components/Site';
import { loadTitles } from '@/lib/data';
import { readStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const store = await readStore();
  const { titles, placeholders } = loadTitles(store.titles, store.generated);
  return <Site titles={titles} placeholders={placeholders} />;
}
