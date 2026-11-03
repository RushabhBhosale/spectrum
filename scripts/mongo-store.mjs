// Keep the two halves of the collection in one atomic, versioned document.
const ID = 'titles';
const conflict = () => new Error('The collection changed while you were editing. Refresh and try again.');

export function mongoStore(collection) {
  return {
    async read(initialStore) {
      const document = await collection.findOne({ _id: ID });
      return document
        ? { titles: document.titles, generated: document.generated, version: document.version }
        : { ...await initialStore(), version: 0 };
    },
    async write({ titles, generated, version }) {
      const document = { _id: ID, titles, generated, version: (version ?? 0) + 1 };
      if (!version) {
        try {
          await collection.insertOne(document);
        } catch (error) {
          if (error?.code === 11000) throw conflict();
          throw error;
        }
        return;
      }
      const result = await collection.replaceOne({ _id: ID, version }, document);
      if (!result.matchedCount) throw conflict();
    },
  };
}
