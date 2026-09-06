// The complete tree reserves directory plots once. Subsequent detail pages
// consume those plots instead of also claiming a second legacy address.
export function sourceLayout(store, id, files, inventory, ref) {
  const result = store.directoryInventory(
    id,
    inventory?.paths || files.map((file) => file.path),
    files,
    inventory?.complete || false,
    inventory?.measurements || files,
  );
  const active = Boolean(
    (inventory && ref) ||
    store.db.prepare('SELECT 1 FROM directory_land WHERE repo=? LIMIT 1').get(id.toLowerCase()),
  );
  const { files: surveyed, ...summary } = result;
  if (active) summary.directories = store.inventoryLand(id, summary.directories);
  const located = active ? store.inventoryFiles(id, surveyed) : surveyed;
  const sources = store.sourceLand(
    id,
    located.filter((file) => !file.directoryLocated).map((file) => file.path),
  );
  return {
    landPlan: sources.landPlan,
    sourceInventory: { ...summary, ref: ref || null },
    files: located.map((file) => ({
      ...file,
      address: file.directoryLocated ? undefined : sources.addresses[file.path],
    })),
  };
}
