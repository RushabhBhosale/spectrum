const POSTER_RATIO = 2 / 3;

/** The largest card that fits every title in the box, so the section never outgrows one screen. */
export function fitRoster(count: number, width: number, height: number, gap: number, ratio = POSTER_RATIO) {
  let best = { columns: 1, card: 0 };
  for (let columns = 1; columns <= Math.max(1, count); columns++) {
    const rows = Math.ceil(count / columns);
    const card = Math.min((width - gap * (columns - 1)) / columns, ((height - gap * (rows - 1)) / rows) * ratio);
    if (card > best.card) best = { columns, card: Math.floor(card) };
  }
  return best;
}
