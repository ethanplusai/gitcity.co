import test from 'node:test';
import assert from 'node:assert/strict';
import { worldStreetGraph } from '../shared/world-street-graph.mjs';
import { graphRoute } from '../src/world/navigation.ts';
import { Vector3 } from 'three';

test('owner-local streets and highway gateways form one route in permanent world coordinates', () => {
  const graph = {
    nodes: [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 10, z: 0 },
    ],
    edges: [{ from: 'a', to: 'b', length: 10 }],
  };
  const owners = [
    { graph, origin: { x: 100, z: 30 } },
    { graph, origin: { x: 200, z: 40 } },
  ];
  const corridors = [
    {
      points: [
        { x: 110, z: 30 },
        { x: 150, z: 30 },
        { x: 200, z: 40 },
      ],
      dependencies: ['b/repo'],
    },
  ];
  const joined = worldStreetGraph(owners, corridors);
  assert.equal(joined.nodes.length, 5);
  const route = graphRoute(new Vector3(102, 1, 30), new Vector3(208, 1, 40), new Vector3(), joined);
  assert.ok(route.some((p) => p.x === 110 && p.z === 30));
  assert.ok(route.some((p) => p.x === 150 && p.z === 30));
  assert.ok(route.some((p) => p.x === 200 && p.z === 40));
  assert.equal(route.at(-1).x, 208);
  assert.deepEqual(
    graphRoute(
      new Vector3(102, 1, 30),
      new Vector3(208, 1, 40),
      new Vector3(),
      worldStreetGraph(owners, []),
    ),
    [],
  );
});

test('bounded vehicle journeys can use highways while disconnected cities stay excluded', async () => {
  const { connectedWorldGraph } = await import('../shared/world-street-graph.mjs');
  const { JourneyNetwork, CityJourneys } = await import('../shared/journeys.mjs');
  const graph = {
    nodes: [
      { id: 'a', x: 0, z: 0 },
      { id: 'b', x: 10, z: 0 },
    ],
    edges: [{ from: 'a', to: 'b', length: 10 }],
  };
  const owners = [0, 40, 1000].map((x) => ({ graph, origin: { x, z: 0 } }));
  const connected = connectedWorldGraph(
    worldStreetGraph(owners, [
      {
        points: [
          { x: 10, z: 0 },
          { x: 40, z: 0 },
        ],
        dependencies: ['b/repo'],
      },
    ]),
    { x: 0, z: 0 },
  );
  assert.equal(connected.nodes.length, 4);
  const destinations = [2, 8, 42, 48].map((x) => ({
    id: `file:${x}`,
    point: { x, z: 1 },
    kind: 'building',
  }));
  const journeys = new CityJourneys(
    new JourneyNetwork(connected, destinations),
    6,
    'highway-traffic',
    true,
  );
  let highwayUsed = false;
  for (let frame = 0; frame < 1800; frame++) {
    journeys.update(0.1, { x: -100, z: -100 }, false);
    highwayUsed ||= journeys.actors.some((actor) => actor.position.x > 12 && actor.position.x < 38);
    assert.equal(journeys.actors.length, 6);
  }
  assert.ok(highwayUsed);
  assert.ok(journeys.completed > 0);
});
