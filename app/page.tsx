import Site from '@/components/Site';
import { loadTitles } from '@/lib/data';

export default function Page() {
  const { titles, placeholders } = loadTitles();
  return <Site titles={titles} placeholders={placeholders} />;
}
