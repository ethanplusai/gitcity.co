import { mergeSourceFiles } from './source-pages.mjs';

export function partitionSourceSnapshot(known, tree, truncated = false) {
  const entries = new Map(tree.map((file) => [file.path, file]));
  const unchanged = [],
    removed = [],
    changed = [];
  for (const file of known) {
    const current = entries.get(file.path);
    if (!current) {
      if (truncated)
        throw Object.assign(
          new Error('The source tree is incomplete; keeping the previous city snapshot.'),
          { status: 503 },
        );
      removed.push(file.path);
    } else if (file.sha && file.sha === current.sha) unchanged.push(file.path);
    else changed.push(current);
  }
  return { unchanged, removed, changed };
}

export function reconcileSourceFiles(previous, initial, results) {
  const verified = new Set(results.flatMap((result) => result.unchanged));
  return mergeSourceFiles(
    previous.filter((file) => verified.has(file.path)),
    [...results.flatMap((result) => result.files), ...initial],
  );
}
