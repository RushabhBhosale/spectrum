import type { Category, Entry } from './types';

/** A title as the studio lists it, with the details that live outside titles.json. */
export type ListedTitle = Entry & { hours: number; poster?: string; year?: number };

type Listed = Pick<ListedTitle, 'title' | 'type' | 'rating' | 'status' | 'quote' | 'hours' | 'year'>;
type Option = { id: string; label: string; test: (title: Listed) => boolean };

const rated = (title: Listed, from: number, below = Infinity) => title.rating !== null && title.rating >= from && title.rating < below;

/** The status a title is filed under. "Watched to season 3" counts as unfinished. */
export const statusOf = ({ status }: Pick<Listed, 'status'>) => {
  if (!status) return 'Finished';
  return status.startsWith('Watched to') ? 'Unfinished' : status;
};

export const STATUS_OPTIONS: Option[] = ['Finished', 'Watching', 'On hold', 'Dropped', 'Unfinished']
  .map((label) => ({ id: label, label, test: (title) => statusOf(title) === label }));

export const RATING_OPTIONS: Option[] = [
  { id: '10', label: 'Perfect 10s', test: (title) => title.rating === 10 },
  { id: '9', label: '9 and up', test: (title) => rated(title, 9) },
  { id: '8', label: '8 to 8.9', test: (title) => rated(title, 8, 9) },
  { id: '7', label: '7 to 7.9', test: (title) => rated(title, 7, 8) },
  { id: 'low', label: 'Below 7', test: (title) => rated(title, 0, 7) },
  { id: 'none', label: 'Unrated', test: (title) => title.rating === null },
];

export const NOTE_OPTIONS: Option[] = [
  { id: 'quote', label: 'Has a quote', test: (title) => Boolean(title.quote) },
  { id: 'no-quote', label: 'No quote yet', test: (title) => !title.quote },
];

export type Filters = { text: string; category: Category | ''; status: string; rating: string; notes: string };

export const NO_FILTERS: Filters = { text: '', category: '', status: '', rating: '', notes: '' };

export const isFiltered = (filters: Filters) => Object.values(filters).some((value) => value.trim());

const passes = (options: Option[], id: string, title: Listed) => !id || Boolean(options.find((option) => option.id === id)?.test(title));

export function matches(title: Listed, filters: Filters) {
  const text = filters.text.trim().toLowerCase();
  return (!text || title.title.toLowerCase().includes(text))
    && (!filters.category || title.type === filters.category)
    && passes(STATUS_OPTIONS, filters.status, title)
    && passes(RATING_OPTIONS, filters.rating, title)
    && passes(NOTE_OPTIONS, filters.notes, title);
}

/** How many titles a choice would show alongside everything else that's already filtered. */
export const countWith = <T extends Listed>(titles: T[], filters: Filters, change: Partial<Filters>) => {
  const next = { ...filters, ...change };
  return titles.filter((title) => matches(title, next)).length;
};

const byName = (a: Listed, b: Listed) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });

// Titles missing a value go last, whichever way the list runs.
const byValue = (read: (title: Listed) => number | null | undefined, direction: 1 | -1) => (a: Listed, b: Listed) => {
  const [left, right] = [read(a), read(b)];
  if (left == null || right == null) return left == null ? (right == null ? byName(a, b) : 1) : -1;
  return (left - right) * direction || byName(a, b);
};

export const SORTS: { id: string; label: string; compare?: (a: Listed, b: Listed) => number }[] = [
  { id: 'added', label: 'Recently added' },
  { id: 'rating-high', label: 'Highest rated', compare: byValue((title) => title.rating, -1) },
  { id: 'rating-low', label: 'Lowest rated', compare: byValue((title) => title.rating, 1) },
  { id: 'name', label: 'Name, A to Z', compare: byName },
  { id: 'name-reverse', label: 'Name, Z to A', compare: (a, b) => byName(b, a) },
  { id: 'year-new', label: 'Newest release', compare: byValue((title) => title.year, -1) },
  { id: 'year-old', label: 'Oldest release', compare: byValue((title) => title.year, 1) },
  { id: 'hours', label: 'Most hours', compare: byValue((title) => title.hours, -1) },
];

/** New titles are saved at the top of the list, so "recently added" is the saved order. */
export function sortTitles<T extends Listed>(titles: T[], sort: string) {
  const compare = SORTS.find((option) => option.id === sort)?.compare;
  return compare ? [...titles].sort(compare) : [...titles];
}
