import type { CanvasObject, ImageObject } from '../types/scene';
import { getRotatedAABB, getBindingAnchor, lineBounds } from '../lib/geometry';
import { isImage, isLine } from '../types/guards';

/**
 * Compute scaled dimensions for an incoming image according to the resize mode.
 * - 'none': keeps original dimensions
 * - 'widest': matches max width of existing images, preserving aspect ratio
 * - 'narrowest': matches min width of existing images, preserving aspect ratio
 */
export function computeAutoResizeDimensions(
  origWidth: number,
  origHeight: number,
  existingObjects: CanvasObject[],
  mode: 'none' | 'widest' | 'narrowest'
): { width: number; height: number } {
  if (mode === 'none' || existingObjects.length === 0 || origWidth <= 0 || origHeight <= 0) {
    return { width: origWidth, height: origHeight };
  }

  const existingImages = existingObjects.filter(isImage);
  if (existingImages.length === 0) {
    return { width: origWidth, height: origHeight };
  }

  const widths = existingImages.map((img) => img.width);
  const targetWidth = mode === 'widest' ? Math.max(...widths) : Math.min(...widths);

  if (targetWidth <= 0) {
    return { width: origWidth, height: origHeight };
  }

  const aspectRatio = origWidth / origHeight;
  const scaledHeight = Math.round(targetWidth / aspectRatio);

  return {
    width: Math.round(targetWidth),
    height: Math.max(1, scaledHeight),
  };
}

/**
 * Updates endpoints and bounding boxes of all lines bound to any moved image object.
 */
export function updateLineBindings(objects: CanvasObject[]): CanvasObject[] {
  const objMap = new Map<string, CanvasObject>(objects.map((o) => [o.id, o]));

  return objects.map((obj) => {
    if (!isLine(obj)) return obj;

    let updated = false;
    const newPoints = obj.points.map((p) => ({ ...p }));

    if (obj.startBinding && objMap.has(obj.startBinding.elementId)) {
      const target = objMap.get(obj.startBinding.elementId)!;
      newPoints[0] = getBindingAnchor(target, obj.startBinding.edge);
      updated = true;
    }

    if (obj.endBinding && objMap.has(obj.endBinding.elementId)) {
      const target = objMap.get(obj.endBinding.elementId)!;
      newPoints[newPoints.length - 1] = getBindingAnchor(target, obj.endBinding.edge);
      updated = true;
    }

    if (!updated) return obj;

    const bounds = lineBounds(newPoints, obj.strokeWidth);
    return {
      ...obj,
      points: newPoints,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    };
  });
}

/**
 * Re-stack objects vertically or horizontally.
 * - Vertical: Sorted by AABB y, sets x = 0, y_i = y_{i-1} + h_{i-1} + spacing
 * - Horizontal: Sorted by AABB x, sets y = 0, x_i = x_{i-1} + w_{i-1} + spacing
 */
export function restackObjects(
  objects: CanvasObject[],
  direction: 'vertical' | 'horizontal',
  spacing: number
): CanvasObject[] {
  const images = objects.filter(isImage);
  if (images.length === 0) return objects;

  const rest = objects.filter((o) => !isImage(o));

  if (direction === 'vertical') {
    // Sort top to bottom by current AABB y
    const sorted = [...images].sort((a, b) => {
      const boxA = getRotatedAABB(a);
      const boxB = getRotatedAABB(b);
      return boxA.y - boxB.y;
    });

    let currentY = 0;
    const repositioned: ImageObject[] = sorted.map((img) => {
      const box = getRotatedAABB(img);
      const deltaX = -box.x; // Set left edge to 0
      const deltaY = currentY - box.y; // Set top edge to currentY

      const newImg: ImageObject = {
        ...img,
        x: img.x + deltaX,
        y: img.y + deltaY,
      };

      const newBox = getRotatedAABB(newImg);
      currentY += newBox.height + spacing;
      return newImg;
    });

    return updateLineBindings([...repositioned, ...rest]);
  } else {
    // Sort left to right by current AABB x
    const sorted = [...images].sort((a, b) => {
      const boxA = getRotatedAABB(a);
      const boxB = getRotatedAABB(b);
      return boxA.x - boxB.x;
    });

    let currentX = 0;
    const repositioned: ImageObject[] = sorted.map((img) => {
      const box = getRotatedAABB(img);
      const deltaX = currentX - box.x; // Set left edge to currentX
      const deltaY = -box.y; // Set top edge to 0

      const newImg: ImageObject = {
        ...img,
        x: img.x + deltaX,
        y: img.y + deltaY,
      };

      const newBox = getRotatedAABB(newImg);
      currentX += newBox.width + spacing;
      return newImg;
    });

    return updateLineBindings([...repositioned, ...rest]);
  }
}

/**
 * Cluster objects into rows within +/- threshold (default 50px) proximity.
 * Sorts by y, starts a new row when |y - rowY| > threshold.
 */
export function clusterIntoRows(
  objects: CanvasObject[],
  threshold: number = 50
): CanvasObject[][] {
  const images = objects.filter(isImage);
  if (images.length === 0) return [];

  // Sort images by AABB y
  const sorted = [...images].sort((a, b) => getRotatedAABB(a).y - getRotatedAABB(b).y);

  const rows: CanvasObject[][] = [];
  let currentRow: CanvasObject[] = [];
  let currentRowReferenceY: number | null = null;

  for (const img of sorted) {
    const box = getRotatedAABB(img);
    if (currentRowReferenceY === null) {
      currentRow = [img];
      currentRowReferenceY = box.y;
    } else if (Math.abs(box.y - currentRowReferenceY) <= threshold) {
      currentRow.push(img);
    } else {
      rows.push(currentRow);
      currentRow = [img];
      currentRowReferenceY = box.y;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Cluster objects into columns within +/- threshold (default 50px) proximity.
 * Sorts by x, starts a new column when |x - colX| > threshold.
 */
export function clusterIntoColumns(
  objects: CanvasObject[],
  threshold: number = 50
): CanvasObject[][] {
  const images = objects.filter(isImage);
  if (images.length === 0) return [];

  // Sort images by AABB x
  const sorted = [...images].sort((a, b) => getRotatedAABB(a).x - getRotatedAABB(b).x);

  const cols: CanvasObject[][] = [];
  let currentCol: CanvasObject[] = [];
  let currentColReferenceX: number | null = null;

  for (const img of sorted) {
    const box = getRotatedAABB(img);
    if (currentColReferenceX === null) {
      currentCol = [img];
      currentColReferenceX = box.x;
    } else if (Math.abs(box.x - currentColReferenceX) <= threshold) {
      currentCol.push(img);
    } else {
      cols.push(currentCol);
      currentCol = [img];
      currentColReferenceX = box.x;
    }
  }

  if (currentCol.length > 0) {
    cols.push(currentCol);
  }

  return cols;
}

/**
 * Apply proximity spacing to rows (vertical) or columns (horizontal).
 * Maintains internal relative order and intra-row/col offsets while scaling the gap between clusters.
 */
export function applyProximitySpacing(
  objects: CanvasObject[],
  axis: 'vertical' | 'horizontal',
  newSpacing: number,
  threshold: number = 50
): CanvasObject[] {
  if (axis === 'vertical') {
    const rows = clusterIntoRows(objects, threshold);
    if (rows.length <= 1) return objects;

    const rowMaxHeights = rows.map((row) =>
      Math.max(...row.map((item) => getRotatedAABB(item).height))
    );

    // Baseline: first row stays at its original top position
    const firstRowBox = getRotatedAABB(rows[0][0]);
    let currentY = firstRowBox.y;

    const movedMap = new Map<string, { deltaX: number; deltaY: number }>();

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rowBaseY = Math.min(...row.map((item) => getRotatedAABB(item).y));
      const rowShiftY = currentY - rowBaseY;

      for (const item of row) {
        movedMap.set(item.id, { deltaX: 0, deltaY: rowShiftY });
      }

      currentY += rowMaxHeights[r] + newSpacing;
    }

    const updated = objects.map((obj) => {
      const delta = movedMap.get(obj.id);
      if (!delta || (delta.deltaX === 0 && delta.deltaY === 0)) return obj;
      return {
        ...obj,
        x: obj.x + delta.deltaX,
        y: obj.y + delta.deltaY,
      };
    });

    return updateLineBindings(updated);
  } else {
    const cols = clusterIntoColumns(objects, threshold);
    if (cols.length <= 1) return objects;

    const colMaxWidths = cols.map((col) =>
      Math.max(...col.map((item) => getRotatedAABB(item).width))
    );

    const firstColBox = getRotatedAABB(cols[0][0]);
    let currentX = firstColBox.x;

    const movedMap = new Map<string, { deltaX: number; deltaY: number }>();

    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const colBaseX = Math.min(...col.map((item) => getRotatedAABB(item).x));
      const colShiftX = currentX - colBaseX;

      for (const item of col) {
        movedMap.set(item.id, { deltaX: colShiftX, deltaY: 0 });
      }

      currentX += colMaxWidths[c] + newSpacing;
    }

    const updated = objects.map((obj) => {
      const delta = movedMap.get(obj.id);
      if (!delta || (delta.deltaX === 0 && delta.deltaY === 0)) return obj;
      return {
        ...obj,
        x: obj.x + delta.deltaX,
        y: obj.y + delta.deltaY,
      };
    });

    return updateLineBindings(updated);
  }
}
