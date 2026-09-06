import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyNetwork, CityJourneys } from '../shared/journeys.mjs';
const graph = {
  nodes: [
    { id: 'a', x: 0, z: 0 },
    { id: 'b', x: 10, z: 0 },
    { id: 'c', x: 10, z: 10 },
    { id: 'd', x: 0, z: 10 },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b', length: 10 },
    { id: 'bc', from: 'b', to: 'c', length: 10 },
    { id: 'cd', from: 'c', to: 'd', length: 10 },
    { id: 'da', from: 'd', to: 'a', length: 10 },
  ],
};
const destinations = [
  { id: 'one/file', point: { x: -1.8, z: 2 } },
  { id: 'two/file', point: { x: 11.8, z: 2 } },
  { id: 'civic', point: { x: 5, z: 11.8 } },
];
const far = { x: 1000, z: 1000 };
test('vehicles detour around a bug-linked repair while pedestrians retain access', () => {
  const network = new JourneyNetwork(graph, destinations, [{ x: 5, z: 0 }]);
  const [a, b] = network.destinations;
  assert.ok(network.path(a, b).edges.includes('ab'));
  const detour = network.path(a, b, true);
  assert.ok(!detour.edges.includes('ab'));
  assert.ok(detour.edges.includes('cd'));
  assert.equal(new JourneyNetwork(graph, destinations).path(a, b, true).edges.includes('ab'), true);
});
test('visitors make deterministic trips, arrive at real destinations, dwell, and select another destination', () => {
  const network = new JourneyNetwork(graph, destinations),
    a = new CityJourneys(network, 6, 'visitors'),
    b = new CityJourneys(network, 6, 'visitors');
  let observedDwell = false;
  for (let step = 0; step < 3000; step++) {
    a.update(0.1, far);
    b.update(0.1, far);
    for (const actor of a.actors)
      if (actor.wait > 0) {
        observedDwell = true;
        assert.ok(
          Math.hypot(
            actor.position.x - actor.target.point.x,
            actor.position.z - actor.target.point.z,
          ) < 1e-6,
        );
      }
  }
  assert.ok(observedDwell);
  assert.ok(a.completed > 6);
  assert.deepEqual(a.snapshot(), b.snapshot());
  const snapshot = a.snapshot();
  a.update(10, far, true);
  assert.deepEqual(a.snapshot(), snapshot);
});
test('vehicles yield to the player and keep their positions when traffic state refreshes', () => {
  const network = new JourneyNetwork(graph, destinations),
    cars = new CityJourneys(network, 1, 'cars', true),
    car = cars.actors[0];
  const before = { ...car.position };
  cars.update(0.5, before);
  assert.deepEqual(car.position, before);
  cars.update(0.5, far);
  assert.notDeepEqual(car.position, before);
  const saved = cars.snapshot(),
    restored = new CityJourneys(network, 1, 'cars', true);
  restored.restore(saved);
  assert.deepEqual(restored.snapshot(), saved);
});

test('changing repository origins preserves ongoing trips in world space', () => {
  const network = new JourneyNetwork(graph, destinations),
    original = new CityJourneys(network, 4, 'visits');
  original.update(3, far);
  const shift = { x: 100, z: -50 },
    translated = new JourneyNetwork(
      { ...graph, nodes: graph.nodes.map((n) => ({ ...n, x: n.x + shift.x, z: n.z + shift.z })) },
      destinations.map((d) => ({
        ...d,
        point: { x: d.point.x + shift.x, z: d.point.z + shift.z },
      })),
    );
  const next = new CityJourneys(translated, 4, 'other-neighborhood');
  next.restore(original.snapshot(), shift);
  next.actors.forEach((actor, i) => {
    assert.ok(
      Math.hypot(
        actor.position.x - shift.x - original.actors[i].position.x,
        actor.position.z - shift.z - original.actors[i].position.z,
      ) < 1e-8,
    );
    assert.equal(actor.target.id, original.actors[i].target.id);
  });
});

test('opposing lanes pass each other instead of producing a permanent stand-off', () => {
  const cars = new CityJourneys(new JourneyNetwork(graph, destinations), 2, 'lanes', true);
  for (const [i, car] of cars.actors.entries()) {
    car.position = { x: i ? -0.42 : 0.42, z: i ? 0.8 : 0 };
    car.angle = i ? Math.PI : 0;
    car.wait = 0;
    car.segment = 0;
    car.progress = 0;
    car.route = [car.position, { x: car.position.x, z: i ? -5 : 5 }];
  }
  const before = cars.actors.map((a) => ({ ...a.position }));
  cars.update(0.1, far);
  cars.actors.forEach((a, i) => assert.notDeepEqual(a.position, before[i]));
});

test('changed street topology reroutes existing trips without moving actors or changing reachable destinations', () => {
  for (const vehicle of [false, true]) {
    const before = new CityJourneys(new JourneyNetwork(graph, destinations), 4, 'replan', vehicle);
    const snapshot = before.snapshot();
    const removed =
      snapshot.actors[0].edges.find((id) => id === 'ab' || id === 'cd') ||
      snapshot.actors[0].edges[0];
    const changed = { ...graph, edges: graph.edges.filter((e) => e.id !== removed) };
    const after = new CityJourneys(new JourneyNetwork(changed, destinations), 4, 'replan', vehicle);
    after.restore(snapshot);
    after.actors.forEach((actor, i) => {
      assert.deepEqual(actor.position, snapshot.actors[i].position);
      assert.equal(actor.target.id, snapshot.actors[i].target);
      assert.ok(!actor.edges.includes(removed));
    });
  }
});

test('street coverage accepts subdivision but rejects a missing section', () => {
  const split = {
    nodes: [...graph.nodes, { id: 'mid', x: 5, z: 0 }],
    edges: [
      ...graph.edges.filter((e) => e.id !== 'ab'),
      { id: 'am', from: 'a', to: 'mid', length: 5 },
      { id: 'mb', from: 'mid', to: 'b', length: 5 },
    ],
  };
  assert.deepEqual(
    new JourneyNetwork(split, destinations).coverage(graph.nodes[0], graph.nodes[1]),
    ['am', 'mb'],
  );
  assert.equal(
    new JourneyNetwork(
      { ...split, edges: split.edges.filter((e) => e.id !== 'mb') },
      destinations,
    ).coverage(graph.nodes[0], graph.nodes[1]),
    null,
  );
});

test('restored actors avoid throwaway route searches while new actors still receive trips', () => {
  const initial = new CityJourneys(new JourneyNetwork(graph, destinations), 6, 'restore-direct');
  const saved = initial.snapshot();
  const network = new JourneyNetwork(graph, destinations);
  const path = network.path.bind(network);
  let searches = 0;
  network.path = (...args) => {
    searches++;
    return path(...args);
  };
  const restored = new CityJourneys(network, 6, 'restore-direct', false, saved);
  assert.equal(searches, 0);
  assert.deepEqual(restored.snapshot(), saved);
  const expanded = new CityJourneys(network, 8, 'restore-direct', false, saved);
  assert.ok(searches > 0);
  assert.equal(expanded.actors.length, 8);
  assert.ok(expanded.actors[6].route.length > 1);
  assert.deepEqual(
    expanded.actors.slice(0, 6).map((a) => a.position),
    initial.actors.map((a) => a.position),
  );
});

test('repeated restoration preserves transit positions and reroutes removed destinations', () => {
  const initial = new CityJourneys(new JourneyNetwork(graph, destinations), 4, 'transit', true);
  const saved = initial.snapshot();
  saved.actors[0].origin = 'transit:0';
  const next = new CityJourneys(new JourneyNetwork(graph, destinations), 4, 'transit', true, saved);
  assert.deepEqual(next.actors[0].position, saved.actors[0].position);
  const removed = saved.actors[0].target;
  const available = destinations.filter((d) => d.id !== removed);
  const rerouted = new CityJourneys(
    new JourneyNetwork(graph, available),
    4,
    'transit',
    true,
    saved,
  );
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(rerouted.actors[i].position, saved.actors[i].position);
    assert.notEqual(rerouted.actors[i].target.id, removed);
  }
});
