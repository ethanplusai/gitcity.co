import {
  cityCell,
  frontageLots,
  connectedStreetGraph,
  landCandidates,
  connectedCityCells,
} from '../../shared/city-plan.mjs';
import type { Repo, LandPlan } from './types';
import { building } from '../../shared/model.mjs';
import { directoryNetwork } from '../../shared/directory-network.mjs';
import { inventoryRegions, translateRegion } from './inventory-layout.ts';
export function plannedLayout(data: Repo, addresses = new Map<string, number>()) {
  const owner = data.id.split('/')[0],
    city = data.landPlan?.city || data.city || data.coordinates || { x: 0, z: 0 },
    anchor = data.coordinates || city;
  const manifest: LandPlan = data.landPlan || {
    version: 2,
    city,
    anchor,
    blocks: landCandidates(
      owner,
      { x: anchor.x - city.x, z: anchor.z - city.z },
      new Set(),
      Math.max(1, Math.ceil(data.files.length / 8)),
    ).map((cell, block) => ({ ...cell, block })),
  };
  const shift = { x: city.x - anchor.x, z: city.z - anchor.z };
  const translate = (p: { x: number; z: number }) => ({ x: p.x + shift.x, z: p.z + shift.z });
  const rawRegions = inventoryRegions(data);
  const regions = rawRegions.map((region) => translateRegion(region, translate));
  const reservedBlocks = manifest.blocks.map((block) => ({
    ...block,
    polygon: block.polygon.map(translate),
    center: translate(block.center),
  }));
  const lots = reservedBlocks.flatMap((block) =>
    frontageLots(block).map((lot) => ({ ...lot, block: block.block })),
  );
  const files = [...data.files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of files) {
    if (Number.isInteger(file.address) && file.address! >= 0 && file.address! < lots.length)
      addresses.set(`v2:${file.path}`, file.address!);
  }
  // A temporarily absent source sample still owns its address. Reusing that
  // slot would overlap two buildings when the earlier file returns.
  const used = new Set<number>(
    [...addresses.entries()]
      .filter(([key, slot]) => key.startsWith('v2:') && slot >= 0 && slot < lots.length)
      .map(([, slot]) => slot),
  );
  const legacyParcels = files
    .filter((file) => !file.directoryLocated)
    .map((file) => {
      const key = `v2:${file.path}`;
      let slot = addresses.get(key);
      if (slot === undefined || slot >= lots.length) {
        slot = lots.findIndex((_, i) => !used.has(i));
        if (slot < 0) {
          // Until the server supplies a durable address manifest, limited
          // reserved land must prioritize actual source files over absent
          // cached samples. Invalidate ownership explicitly before reuse.
          const current = new Set(files.map((f) => `v2:${f.path}`));
          const retired = [...addresses.entries()].find(
            ([path, index]) => path.startsWith('v2:') && !current.has(path) && index < lots.length,
          );
          if (retired) {
            addresses.delete(retired[0]);
            slot = retired[1];
          }
        }
        if (slot < 0) return null;
        addresses.set(key, slot);
        used.add(slot);
      }
      const lot = lots[slot];
      const model = building(file);
      // The address is the fixed entrance on the street, not the center of a
      // generic maximum-depth box. Vary the rear setback, keeping every facade
      // on the same frontage line without changing source-derived volume.
      return {
        ...lot,
        x: lot.front.x - (Math.sin(lot.rotation) * model.depth) / 2,
        z: lot.front.z - (Math.cos(lot.rotation) * model.depth) / 2,
        file,
        scale: 1,
        directory: file.path.includes('/') ? file.path.split('/')[0] : '.',
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const directoryParcels = files
    .filter((file) => file.directoryLocated)
    .flatMap((file) => {
      const directory = file.path.includes('/') ? file.path.split('/')[0] : '.';
      const region = regions.find(
        (region) =>
          region.directory === directory &&
          region.index === Math.floor((file.directoryAddress ?? -1) / 64),
      );
      const lot = region?.lots[file.directoryAddress! % 64];
      if (!region || !lot) return [];
      const model = building(file);
      return [
        {
          ...lot,
          block: region.block,
          file,
          scale: 1,
          directory,
          x: lot.front.x - (Math.sin(lot.rotation) * model.depth) / 2,
          z: lot.front.z - (Math.cos(lot.rotation) * model.depth) / 2,
        },
      ];
    });
  const parcels = [...legacyParcels, ...directoryParcels];
  const occupied = new Set(parcels.map((p) => p.block));
  const legacyBlocks = reservedBlocks.filter((block) => occupied.has(block.block));
  const blocks: (LandPlan['blocks'][number] & { directory?: string })[] = [
    ...legacyBlocks,
    ...regions,
  ];
  const network = rawRegions.length
    ? directoryNetwork(
        owner,
        manifest.blocks.filter((block) => occupied.has(block.block)),
        rawRegions,
      )
    : null;
  const streets = (network?.streets || connectedCityCells(owner, legacyBlocks)).map((cell) => ({
    ...cell,
    polygon: cell.polygon.map(translate),
    center: translate(cell.center),
  }));
  const civic = translate(cityCell(owner, 0, 0).center),
    nodes = streets.flatMap((b) => b.polygon),
    minX = Math.min(...nodes.map((p) => p.x)),
    maxX = Math.max(...nodes.map((p) => p.x)),
    minZ = Math.min(...nodes.map((p) => p.z)),
    maxZ = Math.max(...nodes.map((p) => p.z));
  const graph = network
      ? {
          ...network.graph,
          nodes: network.graph.nodes.map((node) => ({ ...node, ...translate(node) })),
        }
      : connectedStreetGraph(streets, [
          ...blocks,
          ...streets.filter((c) => c.column === 0 && c.row === 0),
        ]),
    nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const lamps = graph.edges.flatMap((edge) => {
    const a = nodesById.get(edge.from)!,
      b = nodesById.get(edge.to)!,
      dx = (b.x - a.x) / edge.length,
      dz = (b.z - a.z) / edge.length,
      result = [];
    for (let distance = 3; distance < edge.length - 2; distance += 8)
      result.push({ x: a.x + dx * distance - dz * 1.45, z: a.z + dz * distance + dx * 1.45 });
    return result;
  });
  return {
    regions,
    parcels,
    destinations: [
      ...parcels.map((p) => ({
        id: `${data.id}/${p.file.path}`,
        point: p.front,
        kind: 'building',
      })),
      { id: `${owner}:civic`, point: { x: civic.x, z: civic.z - 5 }, kind: 'civic' },
    ],
    blocks,
    streets,
    graph,
    lamps,
    map: {
      bounds: { minX, maxX, minZ, maxZ },
      streets: graph.edges.map((edge) => ({
        a: nodesById.get(edge.from)!,
        b: nodesById.get(edge.to)!,
      })),
    },
    civic,
    bounds: { minX, maxX, minZ, maxZ },
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    total: Math.max(maxX - minX, maxZ - minZ),
    side: Math.max(1, Math.ceil(Math.max(maxX - minX, maxZ - minZ) / 24)),
    dirs: [...new Set(parcels.map((p) => p.directory))].sort(),
  };
}
export type PlannedLayout = ReturnType<typeof plannedLayout>;
