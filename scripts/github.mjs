// Vercel's disk is read-only, so the live site saves by committing the two data files.
// The commit then triggers a normal redeploy.

const API = 'https://api.github.com';
export const TITLES_PATH = 'data/titles.json';
export const GENERATED_PATH = 'data/generated.json';

export const serialiseTitles = (titles) => '[\n' + titles.map((t) => '  ' + JSON.stringify(t)).join(',\n') + '\n]\n';
export const serialiseGenerated = (generated) => JSON.stringify(generated, null, 2) + '\n';

export function gitHub({ token, repo, branch = 'main', fetcher = fetch }) {
  async function call(path, options = {}) {
    const res = await fetcher(`${API}/repos/${repo}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}`);
    return res.json();
  }
  const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });

  async function readJson(path) {
    const file = await call(`/contents/${path}?ref=${encodeURIComponent(branch)}`);
    return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  }

  return {
    async read() {
      const [titles, generated] = await Promise.all([readJson(TITLES_PATH), readJson(GENERATED_PATH)]);
      return { titles, generated };
    },
    /** Commits both files together, so one save means one deploy. */
    async write({ titles, generated }, message) {
      const ref = await call(`/git/ref/heads/${encodeURIComponent(branch)}`);
      const parent = ref.object.sha;
      const { tree: baseTree } = await call(`/git/commits/${parent}`);
      const tree = await post('/git/trees', {
        base_tree: baseTree.sha,
        tree: [
          { path: TITLES_PATH, mode: '100644', type: 'blob', content: serialiseTitles(titles) },
          { path: GENERATED_PATH, mode: '100644', type: 'blob', content: serialiseGenerated(generated) },
        ],
      });
      const commit = await post('/git/commits', { message, tree: tree.sha, parents: [parent] });
      await call(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      return commit.sha;
    },
  };
}
