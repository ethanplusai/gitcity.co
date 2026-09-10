import test from 'node:test';
import assert from 'node:assert/strict';
import { progressiveCities } from '../shared/progressive-cities.mjs';

test('construction begins before the directory finishes and consumes subsequent pages', async () => {
  const cities = [0];
  const published = [];
  let complete = false;
  const task = progressiveCities(cities, {
    signal: new AbortController().signal,
    directoryComplete: () => complete,
    load: async (id) => id,
    publish: async (id) => {
      published.push(id);
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(published, [0]);
  cities.push(1, 2, 3);
  complete = true;
  await task;
  assert.deepEqual(published, [0, 1, 2, 3]);
});

test('offscreen neighborhoods wait until exploration brings them into range', async () => {
  const controller = new AbortController();
  const published = [];
  let visible = 0;
  const task = progressiveCities([0, 1, 2], {
    signal: controller.signal,
    eligible: (id) => id <= visible,
    load: async (id) => id,
    publish: async (id) => {
      published.push(id);
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(published, [0]);
  visible = 1;
  await new Promise((resolve) => setTimeout(resolve, 330));
  assert.deepEqual(published, [0, 1]);
  controller.abort();
  await task;
  assert.deepEqual(published, [0, 1]);
});

test('a slow first repo does not hold up its neighbors or limit the city to four repos', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const published = [];
  let active = 0,
    maximum = 0;
  const task = progressiveCities([0, 1, 2, 3, 4, 5, 6], {
    signal: new AbortController().signal,
    load: async (id) => {
      maximum = Math.max(maximum, ++active);
      if (id === 0) await gate;
      active--;
      if (id === 3) throw Error('Unavailable');
      return id;
    },
    publish: async (id) => {
      published.push(id);
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(published, [1, 2, 4, 5, 6]);
  release();
  const failures = await task;
  assert.deepEqual(published, [1, 2, 4, 5, 6, 0]);
  assert.equal(maximum, 2);
  assert.equal(failures[0].city, 3);
});

test('navigation aborts queued cities and prevents stale scene publication', async () => {
  const controller = new AbortController();
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const requested = [],
    published = [];
  const task = progressiveCities([0, 1, 2, 3, 4], {
    signal: controller.signal,
    load: async (id) => {
      requested.push(id);
      await gate;
      return id;
    },
    publish: async (id) => {
      published.push(id);
    },
  });
  controller.abort();
  release();
  await task;
  assert.deepEqual(requested, [0, 1]);
  assert.deepEqual(published, []);
});
