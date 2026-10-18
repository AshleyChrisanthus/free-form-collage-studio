import { describe, it, expect } from 'vitest';
import {
  screenToWorld,
  worldToScreen,
  computeCursorZoom,
  clampUnlimitedZoom,
  clampFramingZoom,
  MIN_UNLIMITED_ZOOM,
  MAX_UNLIMITED_ZOOM,
} from '../src/canvas/viewport';

describe('Viewport Math & Cursor Zoom', () => {
  it('screenToWorld and worldToScreen are exact inverses', () => {
    const pan = { x: 120, y: -45 };
    const zoom = 1.75;
    const screenPt = { x: 450, y: 320 };

    const worldPt = screenToWorld(screenPt, pan, zoom);
    const roundTripScreen = worldToScreen(worldPt, pan, zoom);

    expect(roundTripScreen.x).toBeCloseTo(screenPt.x, 5);
    expect(roundTripScreen.y).toBeCloseTo(screenPt.y, 5);
  });

  it('keeps cursor point invariant in world space during zoom', () => {
    const pan = { x: 200, y: 150 };
    const zoom = 1.0;
    const cursor = { x: 300, y: 250 };

    // Point in world space before zoom
    const worldBefore = screenToWorld(cursor, pan, zoom);

    // Zoom in (deltaY negative)
    const resultIn = computeCursorZoom(zoom, pan, cursor, -100);
    const worldAfterIn = screenToWorld(cursor, { x: resultIn.panX, y: resultIn.panY }, resultIn.zoom);

    expect(worldAfterIn.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfterIn.y).toBeCloseTo(worldBefore.y, 5);
    expect(resultIn.zoom).toBeGreaterThan(zoom);

    // Zoom out (deltaY positive)
    const resultOut = computeCursorZoom(zoom, pan, cursor, 100);
    const worldAfterOut = screenToWorld(cursor, { x: resultOut.panX, y: resultOut.panY }, resultOut.zoom);

    expect(worldAfterOut.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfterOut.y).toBeCloseTo(worldBefore.y, 5);
    expect(resultOut.zoom).toBeLessThan(zoom);
  });

  it('clamps zoom strictly to MIN (0.02) and MAX (10.0)', () => {
    expect(clampUnlimitedZoom(0.001)).toBe(MIN_UNLIMITED_ZOOM);
    expect(clampUnlimitedZoom(15.0)).toBe(MAX_UNLIMITED_ZOOM);
    expect(clampUnlimitedZoom(1.5)).toBe(1.5);

    expect(clampFramingZoom(0.01)).toBe(0.05);
    expect(clampFramingZoom(5.0)).toBe(3.0);

    // Extreme zoom out doesn't go below min
    const resMin = computeCursorZoom(0.021, { x: 0, y: 0 }, { x: 100, y: 100 }, 10000);
    expect(resMin.zoom).toBe(MIN_UNLIMITED_ZOOM);

    // Extreme zoom in doesn't go above max
    const resMax = computeCursorZoom(9.9, { x: 0, y: 0 }, { x: 100, y: 100 }, -10000);
    expect(resMax.zoom).toBe(MAX_UNLIMITED_ZOOM);
  });
});
