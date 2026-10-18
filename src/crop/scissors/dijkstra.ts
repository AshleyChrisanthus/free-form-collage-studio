import type { Point } from '../../types/scene';

/**
 * Min-Heap for Dijkstra / A* pathfinding.
 */
class MinHeap {
  private nodes: Array<{ id: number; dist: number }> = [];

  get size(): number {
    return this.nodes.length;
  }

  push(id: number, dist: number): void {
    this.nodes.push({ id, dist });
    this.up(this.nodes.length - 1);
  }

  pop(): { id: number; dist: number } | undefined {
    if (this.nodes.length === 0) return undefined;
    const top = this.nodes[0];
    const bottom = this.nodes.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = bottom;
      this.down(0);
    }
    return top;
  }

  private up(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.nodes[i].dist < this.nodes[p].dist) {
        const tmp = this.nodes[i];
        this.nodes[i] = this.nodes[p];
        this.nodes[p] = tmp;
        i = p;
      } else {
        break;
      }
    }
  }

  private down(i: number): void {
    const len = this.nodes.length;
    while (true) {
      const left = (i << 1) + 1;
      const right = left + 1;
      let smallest = i;

      if (left < len && this.nodes[left].dist < this.nodes[smallest].dist) {
        smallest = left;
      }
      if (right < len && this.nodes[right].dist < this.nodes[smallest].dist) {
        smallest = right;
      }

      if (smallest !== i) {
        const tmp = this.nodes[i];
        this.nodes[i] = this.nodes[smallest];
        this.nodes[smallest] = tmp;
        i = smallest;
      } else {
        break;
      }
    }
  }
}

const SQRT2 = Math.SQRT2;

/**
 * Finds shortest edge-following path between start and end points using Dijkstra.
 * Bounded by a window around start and end plus margin (default 64px).
 */
export function findPathDijkstra(
  cost: Uint16Array,
  width: number,
  height: number,
  start: Point,
  end: Point,
  margin: number = 64
): Point[] {
  const sx = Math.max(0, Math.min(width - 1, Math.round(start.x)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(start.y)));
  const ex = Math.max(0, Math.min(width - 1, Math.round(end.x)));
  const ey = Math.max(0, Math.min(height - 1, Math.round(end.y)));

  if (sx === ex && sy === ey) {
    return [{ x: sx, y: sy }];
  }

  const minX = Math.max(0, Math.min(sx, ex) - margin);
  const maxX = Math.min(width - 1, Math.max(sx, ex) + margin);
  const minY = Math.max(0, Math.min(sy, ey) - margin);
  const maxY = Math.min(height - 1, Math.max(sy, ey) + margin);

  const winW = maxX - minX + 1;
  const winH = maxY - minY + 1;
  const totalWinPixels = winW * winH;

  const dist = new Float32Array(totalWinPixels);
  dist.fill(Infinity);

  const prev = new Int32Array(totalWinPixels);
  prev.fill(-1);

  const startWinIdx = (sy - minY) * winW + (sx - minX);
  const targetWinIdx = (ey - minY) * winW + (ex - minX);

  dist[startWinIdx] = 0;

  const heap = new MinHeap();
  heap.push(startWinIdx, 0);

  // 8-neighborhood directions
  const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
  const DIST_MULT = [SQRT2, 1, SQRT2, 1, 1, SQRT2, 1, SQRT2];

  while (heap.size > 0) {
    const cur = heap.pop()!;
    const u = cur.id;
    const d = cur.dist;

    if (u === targetWinIdx) break;
    if (d > dist[u]) continue;

    const uy = Math.floor(u / winW);
    const ux = u % winW;
    const globalX = minX + ux;
    const globalY = minY + uy;

    for (let i = 0; i < 8; i++) {
      const vx = ux + DX[i];
      const vy = uy + DY[i];

      if (vx < 0 || vx >= winW || vy < 0 || vy >= winH) continue;

      const neighborGlobalX = globalX + DX[i];
      const neighborGlobalY = globalY + DY[i];
      const neighborCost = cost[neighborGlobalY * width + neighborGlobalX];

      const vWinIdx = vy * winW + vx;
      const alt = d + neighborCost * DIST_MULT[i];

      if (alt < dist[vWinIdx]) {
        dist[vWinIdx] = alt;
        prev[vWinIdx] = u;
        heap.push(vWinIdx, alt);
      }
    }
  }

  // Reconstruct path
  if (prev[targetWinIdx] === -1 && targetWinIdx !== startWinIdx) {
    return [
      { x: sx, y: sy },
      { x: ex, y: ey },
    ];
  }

  const path: Point[] = [];
  let curr = targetWinIdx;
  while (curr !== -1) {
    const cy = Math.floor(curr / winW) + minY;
    const cx = (curr % winW) + minX;
    path.push({ x: cx, y: cy });
    if (curr === startWinIdx) break;
    curr = prev[curr];
  }

  path.reverse();
  return path;
}
