// A cursor belongs to one repository snapshot and directory. Pinning the ref
// avoids skipping or repeating files when a commit arrives between pages.
export function sourcePage(files, ref, directory, cursor = '', limit = 64) {
  let after = '';
  if (cursor) {
    let value;
    try {
      value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    } catch {
      /* validated below */
    }
    if (!value || typeof value.path !== 'string' || value.directory !== directory)
      throw Object.assign(new Error('Invalid source-page cursor.'), { status: 400 });
    if (value.ref !== ref)
      throw Object.assign(
        new Error('This repository changed. Explore this directory again to use its new snapshot.'),
        { status: 409 },
      );
    after = value.path;
  }
  const ordered = files
    .filter((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.') === directory)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const remaining = ordered.filter((f) => f.path > after);
  const selected = remaining.slice(0, limit);
  return {
    files: selected,
    total: ordered.length,
    nextCursor:
      remaining.length > selected.length
        ? Buffer.from(JSON.stringify({ ref, directory, path: selected.at(-1).path })).toString(
            'base64url',
          )
        : null,
    ref,
  };
}

// Incremental detail must never erase another directory or an earlier page.
export function mergeSourceFiles(existing, incoming) {
  const files = new Map(existing.map((file) => [file.path, file]));
  for (const file of incoming) {
    const previous = files.get(file.path);
    files.set(
      file.path,
      previous?.sha && file.sha && previous.sha !== file.sha ? file : { ...previous, ...file },
    );
  }
  return [...files.values()];
}
