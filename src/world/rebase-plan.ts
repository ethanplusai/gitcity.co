import type { PlannedLayout } from './planned-layout';
import { translateRegion } from './inventory-layout.ts';

// Directory networks use city-space node identities. Rebase their coordinates
// for the active district without rebuilding topology or assigning new streets.
export function rebasePlan(plan: PlannedLayout, dx: number, dz: number): PlannedLayout {
  const point = <P extends { x: number; z: number }>(p: P): P => ({
    ...p,
    x: p.x + dx,
    z: p.z + dz,
  });
  const bounds = {
    minX: plan.bounds.minX + dx,
    maxX: plan.bounds.maxX + dx,
    minZ: plan.bounds.minZ + dz,
    maxZ: plan.bounds.maxZ + dz,
  };
  const graph = { ...plan.graph, nodes: plan.graph.nodes.map(point) };
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    ...plan,
    graph,
    bounds,
    regions: plan.regions.map((region) => translateRegion(region, point)),
    parcels: plan.parcels.map((parcel) => ({ ...point(parcel), front: point(parcel.front) })),
    destinations: plan.destinations.map((d) => ({ ...d, point: point(d.point) })),
    blocks: plan.blocks.map((block) => ({
      ...block,
      center: point(block.center),
      polygon: block.polygon.map(point),
    })),
    streets: plan.streets.map((street) => ({
      ...street,
      center: point(street.center),
      polygon: street.polygon.map(point),
    })),
    lamps: plan.lamps.map(point),
    center: point(plan.center),
    civic: point(plan.civic),
    map: {
      bounds,
      streets: graph.edges.map((edge) => ({ a: nodes.get(edge.from)!, b: nodes.get(edge.to)! })),
    },
  };
}
