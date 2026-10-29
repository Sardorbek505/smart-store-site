import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeTilt} from '../scripts/depth.js';
const origin = {beta: 50, gamma: 0};
test('phone depth calibrates the resting grip and rejects unavailable sensor values', () => {
  assert.deepEqual(relativeTilt(50, 0, origin), {x: 0, y: 0});
  for (const value of [null, undefined, NaN, Infinity, '10'])
    assert.equal(relativeTilt(value, 10, origin), null);
  assert.deepEqual(relativeTilt(50.1, 0.1, origin), {x: 0, y: 0});
});
test('phone depth maps portrait and landscape without relying on compass orientation', () => {
  assert.deepEqual(relativeTilt(59, 9, origin), {x: .5, y: .5});
  const landscape = relativeTilt(59, 9, origin, 90);
  assert.ok(Math.abs(landscape.x - .5) < 1e-9);
  assert.ok(Math.abs(landscape.y + .5) < 1e-9);
  const flipped = relativeTilt(59, 9, origin, 180);
  assert.ok(Math.abs(flipped.x + .5) < 1e-9);
  assert.ok(Math.abs(flipped.y + .5) < 1e-9);
});
test('phone depth clamps extreme angles and wraps beta at the back of the phone', () => {
  assert.deepEqual(relativeTilt(150, 89, origin), {x: 1, y: 1});
  assert.ok(Math.abs(relativeTilt(-179, 0, {beta: 179, gamma: 0}).y - 2/18) < 1e-9);
});
