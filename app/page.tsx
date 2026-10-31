import Spectrum from '@/components/Spectrum';
import { loadTitles } from '@/lib/data';

export default function Page() {
  const { titles, placeholders } = loadTitles();
  return <Spectrum titles={titles} placeholders={placeholders} />;
}
