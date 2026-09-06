import test from 'node:test';
import assert from 'node:assert/strict';
import { planConnection, segmentHitsSite, gateway } from '../shared/road-network.mjs';
const site = { minX: -10, maxX: 10, minZ: -8, maxZ: 8 };
test('dependency routes avoid neighborhoods and retain their exact gateways', () => {
  const start = { x: -20, z: 0 },
    end = { x: 20, z: 0 },
    route = planConnection(start, end, [site]);
  assert.ok(route.length >= 4);
  assert.deepEqual(route[0], start);
  assert.deepEqual(route.at(-1), end);
  for (let i = 1; i < route.length; i++)
    assert.equal(segmentHitsSite(route[i - 1], route[i], site, 0.6), false);
  assert.deepEqual(route, planConnection(start, end, [site]));
});
test('gateways face the destination and blocked endpoints fail without drawing through land', () => {
  assert.deepEqual(gateway(site, { x: 100, z: 0 }), { x: 11.1, z: 0 });
  assert.equal(planConnection({ x: 0, z: 0 }, { x: 20, z: 0 }, [site]), null);
});
test('several intervening neighborhoods remain protected', () => {
  const sites = [
    site,
    { minX: 13, maxX: 24, minZ: -15, maxZ: 13 },
    { minX: 26, maxX: 35, minZ: -9, maxZ: 9 },
  ];
  const route = planConnection({ x: -20, z: 0 }, { x: 45, z: 0 }, sites);
  assert.ok(route);
  for (let i = 1; i < route.length; i++)
    for (const box of sites) assert.equal(segmentHitsSite(route[i - 1], route[i], box, 0.6), false);
});

test('loaded gateways attach to actual outer junctions without crossing the street interior', async () => {
  const { streetGateway } = await import('../shared/road-network.mjs');
  const nodes = [
    { x: -8, z: -6 },
    { x: 8, z: -6 },
    { x: 8, z: 6 },
    { x: -8, z: 6 },
  ];
  for (const toward of [
    { x: 100, z: 2 },
    { x: -100, z: -2 },
    { x: 2, z: 100 },
    { x: -2, z: -100 },
  ]) {
    const terminal = streetGateway(site, toward, nodes);
    assert.ok(nodes.some((p) => p.x === terminal.entrance.x && p.z === terminal.entrance.z));
    assert.equal(
      segmentHitsSite(terminal.entrance, terminal.exit, { minX: -8, maxX: 8, minZ: -6, maxZ: 6 }),
      false,
    );
    assert.deepEqual(terminal, streetGateway(site, toward, [...nodes].reverse()));
    const route = planConnection(terminal.exit, toward, [site]);
    assert.ok(route);
    assert.deepEqual(route[0], terminal.exit);
  }
  assert.deepEqual(streetGateway(site, { x: 100, z: 2 }, null), {
    entrance: null,
    exit: gateway(site, { x: 100, z: 2 }),
  });
});

test('shared highways retain every dependency and draw overlapping pavement only once', async () => {
  const { sharedCorridors } = await import('../shared/road-network.mjs');
  const p = (x) => ({ x, z: 0 });
  const routes = [
    { dependency: 'a/repo', points: [p(0), p(5), p(10)] },
    { dependency: 'b/repo', points: [p(15), p(3)] },
  ];
  const corridors = sharedCorridors(routes);
  const length = (points) =>
    points
      .slice(1)
      .reduce((sum, b, i) => sum + Math.hypot(b.x - points[i].x, b.z - points[i].z), 0);
  assert.equal(
    corridors.reduce((sum, c) => sum + length(c.points), 0),
    15,
  );
  assert.equal(
    corridors
      .filter((c) => c.dependencies.length === 2)
      .reduce((sum, c) => sum + length(c.points), 0),
    7,
  );
  assert.deepEqual(sharedCorridors([...routes].reverse()), corridors);
  const bent = sharedCorridors([{ dependency: 'a/repo', points: [p(0), p(5), { x: 5, z: 5 }] }]);
  assert.equal(bent.length, 1);
  assert.equal(bent[0].points.length, 3);
});
