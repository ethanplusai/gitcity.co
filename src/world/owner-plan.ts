import { connectedStreetGraph, connectedCityCells } from '../../shared/city-plan.mjs';
import { plannedLayout, type PlannedLayout } from './planned-layout.ts';
import type { Repo } from './types';
import { directoryNetwork } from '../../shared/directory-network.mjs';
import { translateRegion, type InventoryRegion } from './inventory-layout.ts';

// Repositories keep their permanent anchors; shared civic geometry lives in owner coordinates.
export function ownerPlan(
  repositories: Repo[],
  addresses = new Map<string, Map<string, number>>(),
  origin = repositories[0]?.landPlan?.city,
  layouts?: Map<Repo, PlannedLayout>,
) {
  if (!origin || !repositories.length)
    throw new Error('An owner plan requires reserved repository land');
  const owner = repositories[0].id.split('/')[0].toLowerCase();
  const plans = repositories
    .filter((r) => r.landPlan && r.id.split('/')[0].toLowerCase() === owner)
    .map((repo) => {
      let slots = addresses.get(repo.id);
      if (!slots) {
        slots = new Map();
        addresses.set(repo.id, slots);
      }
      const plan = plannedLayout(repo, slots);
      layouts?.set(repo, plan);
      return { repo, plan };
    });
  const blocks = new Map<string, PlannedLayout['blocks'][number]>();
  const parcels: PlannedLayout['parcels'] = [];
  const regions: InventoryRegion[] = [];
  const destinations = new Map<string, PlannedLayout['destinations'][number]>();
  for (const { repo, plan } of plans) {
    const anchor = repo.coordinates || repo.landPlan!.anchor,
      dx = anchor.x - origin.x,
      dz = anchor.z - origin.z;
    const point = (p: { x: number; z: number }) => ({ x: p.x + dx, z: p.z + dz });
    regions.push(...plan.regions.map((region) => translateRegion(region, point)));
    for (const destination of plan.destinations)
      destinations.set(destination.id, { ...destination, point: point(destination.point) });
    for (const block of plan.blocks)
      blocks.set(`${block.column}:${block.row}`, {
        ...block,
        center: point(block.center),
        polygon: block.polygon.map(point),
      });
    for (const p of plan.parcels) parcels.push({ ...p, ...point(p), front: point(p.front) });
  }
  // Reconnect the owner as one city. Retaining every repository's independent
  // approach roads recreates empty grids between otherwise adjacent districts.
  const city = plans[0].repo.landPlan!.city;
  const toCity = (p: { x: number; z: number }) => ({
    x: p.x + origin.x - city.x,
    z: p.z + origin.z - city.z,
  });
  const network = regions.length
    ? directoryNetwork(
        owner,
        [...blocks.values()]
          .filter((block) => !block.directory)
          .map((block) => ({
            ...block,
            center: toCity(block.center),
            polygon: block.polygon.map(toCity),
          })),
        regions.map((region) => translateRegion(region, toCity)),
      )
    : null;
  const streetList = (network?.streets || connectedCityCells(owner, [...blocks.values()])).map(
      (cell) => ({
        ...cell,
        center: { x: cell.center.x + city.x - origin.x, z: cell.center.z + city.z - origin.z },
        polygon: cell.polygon.map((p: { x: number; z: number }) => ({
          x: p.x + city.x - origin.x,
          z: p.z + city.z - origin.z,
        })),
      }),
    ),
    graph = network
      ? {
          ...network.graph,
          nodes: network.graph.nodes.map((node) => ({
            ...node,
            x: node.x + city.x - origin.x,
            z: node.z + city.z - origin.z,
          })),
        }
      : connectedStreetGraph(streetList, [
          ...blocks.values(),
          ...streetList.filter((c) => c.column === 0 && c.row === 0),
        ]),
    nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const minX = Math.min(...graph.nodes.map((n) => n.x)),
    maxX = Math.max(...graph.nodes.map((n) => n.x)),
    minZ = Math.min(...graph.nodes.map((n) => n.z)),
    maxZ = Math.max(...graph.nodes.map((n) => n.z));
  const bounds = { minX, maxX, minZ, maxZ },
    lamps = graph.edges.flatMap((edge) => {
      const a = nodes.get(edge.from)!,
        b = nodes.get(edge.to)!,
        dx = (b.x - a.x) / edge.length,
        dz = (b.z - a.z) / edge.length,
        result = [];
      for (let distance = 3; distance < edge.length - 2; distance += 8)
        result.push({ x: a.x + dx * distance - dz * 1.45, z: a.z + dz * distance + dx * 1.45 });
      return result;
    });
  const first = plans[0],
    anchor = first.repo.coordinates || first.repo.landPlan!.anchor;
  return {
    ...first.plan,
    regions,
    parcels,
    destinations: [...destinations.values()],
    blocks: [...blocks.values()],
    streets: streetList,
    graph,
    lamps,
    bounds,
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    total: Math.max(maxX - minX, maxZ - minZ),
    map: {
      bounds,
      streets: graph.edges.map((e) => ({ a: nodes.get(e.from)!, b: nodes.get(e.to)! })),
    },
    civic: {
      x: first.plan.civic.x + anchor.x - origin.x,
      z: first.plan.civic.z + anchor.z - origin.z,
    },
  };
}
