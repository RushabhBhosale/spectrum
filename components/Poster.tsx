import type { Title } from '@/lib/types';

/** A title's poster, or its own colours if it has none. */
export default function Poster({ title }: { title: Title }) {
  return (
    <span className="poster-frame" style={{ background: title.accent }}>
      {title.poster && <img src={title.poster} alt="" loading="lazy" decoding="async" />}
    </span>
  );
}
