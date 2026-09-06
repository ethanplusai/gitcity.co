import { directoryBlock } from '../../shared/directory-block.mjs';
import type { Repo } from './types';

type Point = { x: number; z: number };
export function inventoryRegions(data: Repo) {
  const result = [];
  for (const directory of data.sourceInventory?.directories || [])
    for (const summary of directory.blocks) {
      if (
        !Number.isInteger(summary.column) ||
        !Number.isInteger(summary.row) ||
        !summary.mask ||
        !/^[0-9a-f]{1,16}$/.test(summary.mask)
      )
        continue;
      const mask = BigInt('0x' + summary.mask);
      const legacy = BigInt('0x' + (summary.legacyMask || '0'));
      const available = mask & ~legacy;
      if (!available) continue;
      const detailed = new Set(
        data.files
          .filter(
            (file) =>
              file.directoryLocated &&
              (file.path.includes('/') ? file.path.split('/')[0] : '.') === directory.name &&
              Math.floor((file.directoryAddress ?? -1) / 64) === summary.index,
          )
          .map((file) => file.directoryAddress! % 64),
      );
      const geometry = directoryBlock(data.id.split('/')[0], summary.column, summary.row);
      const occupied = Array.from({ length: 64 }, (_, slot) => slot).filter((slot) =>
        Boolean(available & (BigInt(1) << BigInt(slot))),
      );
      result.push({
        ...geometry,
        // Detail resolution never changes road occupancy. Only actual tree
        // membership does; unused rows are reserved land, not built streets.
        streets: geometry.streets.filter((_, index) =>
          occupied.some((slot) => Math.floor(slot / 22) === index),
        ),
        occupied,
        block: -1 - (summary.column! + 65536) * 131072 - (summary.row! + 65536),
        directory: directory.name,
        index: summary.index,
        repo: data.id,
        unresolved: occupied.filter((slot) => !detailed.has(slot)),
      });
    }
  return result;
}
export type InventoryRegion = ReturnType<typeof inventoryRegions>[number];
export function translateRegion(
  region: InventoryRegion,
  point: (point: Point) => Point,
): InventoryRegion {
  return {
    ...region,
    center: point(region.center),
    polygon: region.polygon.map(point),
    cells: region.cells.map((cell) => ({
      ...cell,
      center: point(cell.center),
      polygon: cell.polygon.map(point),
    })),
    streets: region.streets.map((street) => ({ a: point(street.a), b: point(street.b) })),
    lots: region.lots.map((lot) => ({ ...lot, ...point(lot), front: point(lot.front) })),
  };
}
