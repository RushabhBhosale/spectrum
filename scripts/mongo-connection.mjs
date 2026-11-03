// Share one connection attempt per function instance, but don't cache a failed client.
export function mongoConnection(createClient) {
  let cached;
  return {
    async get(uri) {
      if (!cached || cached.uri !== uri) {
        const client = createClient(uri);
        const entry = { uri, client, promise: null };
        entry.promise = client.connect().then(() => client).catch((error) => {
          if (cached === entry) cached = undefined;
          throw error;
        });
        cached = entry;
      }
      return cached.promise;
    },
    discard(client) {
      if (cached?.client === client) cached = undefined;
    },
  };
}
