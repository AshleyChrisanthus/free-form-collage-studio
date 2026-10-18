import type {
  BoundingBox,
  CanvasObject,
  ViewportState,
  GlobalSettings,
} from '../types/scene';
import { getRotatedAABB } from '../lib/geometry';
import { computeCanvasSize } from '../framing/canvasSize';
import type { ResizeHandleType } from '../canvas/drawOverlay';

export interface SnapLine {
  pos: number;
  min: number;
  max: number;
}

export interface SnapGuide {
  orientation: 'h' | 'v';
  pos: number;
  start: number;
  end: number;
}

export interface SnapResult {
  deltaX: number;
  deltaY: number;
  guides: SnapGuide[];
}

export interface CandidateLines {
  xLines: SnapLine[];
  yLines: SnapLine[];
}

/**
 * Precompute snap lines from all stationary visible objects and canvas bounds.
 */
export function precomputeSnapLines(
  objects: CanvasObject[],
  ignoreIds: Set<string>,
  viewport?: ViewportState,
  settings?: GlobalSettings
): CandidateLines {
  const xLines: SnapLine[] = [];
  const yLines: SnapLine[] = [];

  for (const obj of objects) {
    if (ignoreIds.has(obj.id)) continue;
    const box = getRotatedAABB(obj);
    const left = box.x;
    const centerX = box.x + box.width / 2;
    const right = box.x + box.width;
    const top = box.y;
    const centerY = box.y + box.height / 2;
    const bottom = box.y + box.height;

    // X candidates (vertical lines)
    xLines.push(
      { pos: left, min: top, max: bottom },
      { pos: centerX, min: top, max: bottom },
      { pos: right, min: top, max: bottom }
    );

    // Y candidates (horizontal lines)
    yLines.push(
      { pos: top, min: left, max: right },
      { pos: centerY, min: left, max: right },
      { pos: bottom, min: left, max: right }
    );
  }

  // In standard framing mode, also include canvas stage boundaries
  if (viewport && viewport.workMode === 'standard') {
    const stage = computeCanvasSize(objects, viewport, settings);
    const sLeft = stage.x;
    const sCenterX = stage.x + stage.width / 2;
    const sRight = stage.x + stage.width;
    const sTop = stage.y;
    const sCenterY = stage.y + stage.height / 2;
    const sBottom = stage.y + stage.height;

    xLines.push(
      { pos: sLeft, min: sTop, max: sBottom },
      { pos: sCenterX, min: sTop, max: sBottom },
      { pos: sRight, min: sTop, max: sBottom }
    );

    yLines.push(
      { pos: sTop, min: sLeft, max: sRight },
      { pos: sCenterY, min: sLeft, max: sRight },
      { pos: sBottom, min: sLeft, max: sRight }
    );
  }

  // Sort candidate lines for fast binary search
  xLines.sort((a, b) => a.pos - b.pos);
  yLines.sort((a, b) => a.pos - b.pos);

  return { xLines, yLines };
}

/**
 * Snap a moving bounding box to candidate lines.
 */
export function snapMove(
  movingBox: BoundingBox,
  candidates: CandidateLines,
  threshold: number
): SnapResult {
  const movingLeft = movingBox.x;
  const movingCenterX = movingBox.x + movingBox.width / 2;
  const movingRight = movingBox.x + movingBox.width;

  const movingTop = movingBox.y;
  const movingCenterY = movingBox.y + movingBox.height / 2;
  const movingBottom = movingBox.y + movingBox.height;

  let bestDeltaX = 0;
  let minDiffX = threshold + 1;
  let matchedXGuide: SnapGuide | null = null;

  const movingXEdges = [movingLeft, movingCenterX, movingRight];
  for (const mX of movingXEdges) {
    for (const line of candidates.xLines) {
      const diff = line.pos - mX;
      const absDiff = Math.abs(diff);
      if (absDiff <= threshold && absDiff < minDiffX) {
        minDiffX = absDiff;
        bestDeltaX = diff;
        matchedXGuide = {
          orientation: 'v',
          pos: line.pos,
          start: Math.min(line.min, movingTop),
          end: Math.max(line.max, movingBottom),
        };
      }
    }
  }

  let bestDeltaY = 0;
  let minDiffY = threshold + 1;
  let matchedYGuide: SnapGuide | null = null;

  const movingYEdges = [movingTop, movingCenterY, movingBottom];
  for (const mY of movingYEdges) {
    for (const line of candidates.yLines) {
      const diff = line.pos - mY;
      const absDiff = Math.abs(diff);
      if (absDiff <= threshold && absDiff < minDiffY) {
        minDiffY = absDiff;
        bestDeltaY = diff;
        matchedYGuide = {
          orientation: 'h',
          pos: line.pos,
          start: Math.min(line.min, movingLeft),
          end: Math.max(line.max, movingRight),
        };
      }
    }
  }

  const guides: SnapGuide[] = [];
  if (matchedXGuide) guides.push(matchedXGuide);
  if (matchedYGuide) guides.push(matchedYGuide);

  return {
    deltaX: bestDeltaX,
    deltaY: bestDeltaY,
    guides,
  };
}

/**
 * Snap only the active handle edges being resized to candidate lines.
 */
export function snapResize(
  box: BoundingBox,
  handle: ResizeHandleType,
  candidates: CandidateLines,
  threshold: number
): { box: BoundingBox; guides: SnapGuide[] } {
  let { x, y, width, height } = box;
  const guides: SnapGuide[] = [];

  const snapsLeft = handle === 'tl' || handle === 'ml' || handle === 'bl';
  const snapsRight = handle === 'tr' || handle === 'mr' || handle === 'br';
  const snapsTop = handle === 'tl' || handle === 'tc' || handle === 'tr';
  const snapsBottom = handle === 'bl' || handle === 'bc' || handle === 'br';

  if (snapsLeft) {
    let minDiff = threshold + 1;
    let bestDelta = 0;
    let guide: SnapGuide | null = null;

    for (const line of candidates.xLines) {
      const diff = line.pos - x;
      if (Math.abs(diff) <= threshold && Math.abs(diff) < minDiff) {
        minDiff = Math.abs(diff);
        bestDelta = diff;
        guide = {
          orientation: 'v',
          pos: line.pos,
          start: Math.min(line.min, y),
          end: Math.max(line.max, y + height),
        };
      }
    }

    if (guide && width - bestDelta >= 20) {
      x += bestDelta;
      width -= bestDelta;
      guides.push(guide);
    }
  } else if (snapsRight) {
    let minDiff = threshold + 1;
    let bestDelta = 0;
    let guide: SnapGuide | null = null;
    const currentRight = x + width;

    for (const line of candidates.xLines) {
      const diff = line.pos - currentRight;
      if (Math.abs(diff) <= threshold && Math.abs(diff) < minDiff) {
        minDiff = Math.abs(diff);
        bestDelta = diff;
        guide = {
          orientation: 'v',
          pos: line.pos,
          start: Math.min(line.min, y),
          end: Math.max(line.max, y + height),
        };
      }
    }

    if (guide && width + bestDelta >= 20) {
      width += bestDelta;
      guides.push(guide);
    }
  }

  if (snapsTop) {
    let minDiff = threshold + 1;
    let bestDelta = 0;
    let guide: SnapGuide | null = null;

    for (const line of candidates.yLines) {
      const diff = line.pos - y;
      if (Math.abs(diff) <= threshold && Math.abs(diff) < minDiff) {
        minDiff = Math.abs(diff);
        bestDelta = diff;
        guide = {
          orientation: 'h',
          pos: line.pos,
          start: Math.min(line.min, x),
          end: Math.max(line.max, x + width),
        };
      }
    }

    if (guide && height - bestDelta >= 20) {
      y += bestDelta;
      height -= bestDelta;
      guides.push(guide);
    }
  } else if (snapsBottom) {
    let minDiff = threshold + 1;
    let bestDelta = 0;
    let guide: SnapGuide | null = null;
    const currentBottom = y + height;

    for (const line of candidates.yLines) {
      const diff = line.pos - currentBottom;
      if (Math.abs(diff) <= threshold && Math.abs(diff) < minDiff) {
        minDiff = Math.abs(diff);
        bestDelta = diff;
        guide = {
          orientation: 'h',
          pos: line.pos,
          start: Math.min(line.min, x),
          end: Math.max(line.max, x + width),
        };
      }
    }

    if (guide && height + bestDelta >= 20) {
      height += bestDelta;
      guides.push(guide);
    }
  }

  return {
    box: { x, y, width, height },
    guides,
  };
}
