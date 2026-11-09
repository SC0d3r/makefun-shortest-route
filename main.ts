import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const K = 12;

interface Instance {
  n: number;
  xs: Int32Array;
  ys: Int32Array;
}

interface CandidateLists {
  ids: Int32Array;
  counts: Int32Array;
}

function readInstance(path: string): Instance {
  const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/);
  const n = Number(lines[0]);
  const xs = new Int32Array(n);
  const ys = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const parts = lines[i + 1]!.trim().split(/\s+/);
    xs[i] = Number(parts[0]);
    ys[i] = Number(parts[1]);
  }
  return { n, xs, ys };
}

function buildCandidates(xs: Int32Array, ys: Int32Array, n: number): CandidateLists {
  let minX = xs[0]!;
  let maxX = xs[0]!;
  let minY = ys[0]!;
  let maxY = ys[0]!;
  for (let i = 1; i < n; i++) {
    const x = xs[i]!;
    const y = ys[i]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  let cell = Math.sqrt((width * height) / n) * 1.2;
  if (!(cell >= 1)) cell = 1;
  const gx = Math.max(1, Math.floor(width / cell) + 1);
  const gy = Math.max(1, Math.floor(height / cell) + 1);
  const cellCount = gx * gy;

  const head = new Int32Array(cellCount);
  head.fill(-1);
  const next = new Int32Array(n);
  next.fill(-1);
  const cellX = new Int32Array(n);
  const cellY = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    let cx = Math.floor((xs[i]! - minX) / cell);
    let cy = Math.floor((ys[i]! - minY) / cell);
    if (cx < 0) cx = 0;
    else if (cx >= gx) cx = gx - 1;
    if (cy < 0) cy = 0;
    else if (cy >= gy) cy = gy - 1;
    cellX[i] = cx;
    cellY[i] = cy;
    const index = cy * gx + cx;
    next[i] = head[index]!;
    head[index] = i;
  }

  const ids = new Int32Array(n * K);
  const counts = new Int32Array(n);
  const found = new Int32Array(n);
  const bestIds = new Int32Array(K);
  const bestDistances = new Float64Array(K);

  for (let i = 0; i < n; i++) {
    const cx = cellX[i]!;
    const cy = cellY[i]!;
    const xi = xs[i]!;
    const yi = ys[i]!;
    let foundCount = 0;
    const maxRing = Math.max(cx, gx - 1 - cx, cy, gy - 1 - cy);

    for (let r = 0; r <= maxRing; r++) {
      if (r === 0) {
        for (let city = head[cy * gx + cx]!; city !== -1; city = next[city]!) {
          found[foundCount++] = city;
        }
      } else {
        const x0 = Math.max(0, cx - r);
        const x1 = Math.min(gx - 1, cx + r);
        const y0 = Math.max(0, cy - r);
        const y1 = Math.min(gy - 1, cy + r);

        if (cy - r >= 0) {
          const row = (cy - r) * gx;
          for (let x = x0; x <= x1; x++) {
            for (let city = head[row + x]!; city !== -1; city = next[city]!) {
              found[foundCount++] = city;
            }
          }
        }
        if (cy + r < gy) {
          const row = (cy + r) * gx;
          for (let x = x0; x <= x1; x++) {
            for (let city = head[row + x]!; city !== -1; city = next[city]!) {
              found[foundCount++] = city;
            }
          }
        }
        if (cx - r >= 0) {
          for (let y = y0 + 1; y < y1; y++) {
            for (let city = head[y * gx + cx - r]!; city !== -1; city = next[city]!) {
              found[foundCount++] = city;
            }
          }
        }
        if (cx + r < gx) {
          for (let y = y0 + 1; y < y1; y++) {
            for (let city = head[y * gx + cx + r]!; city !== -1; city = next[city]!) {
              found[foundCount++] = city;
            }
          }
        }
      }

      if (foundCount - 1 >= K && r >= 2) break;
    }

    let count = 0;
    for (let p = 0; p < foundCount; p++) {
      const city = found[p]!;
      if (city === i) continue;
      const dx = xs[city]! - xi;
      const dy = ys[city]! - yi;
      const distance = dx * dx + dy * dy;

      if (count < K) {
        let q = count - 1;
        while (
          q >= 0 &&
          (bestDistances[q]! > distance ||
            (bestDistances[q] === distance && bestIds[q]! > city))
        ) {
          bestDistances[q + 1] = bestDistances[q]!;
          bestIds[q + 1] = bestIds[q]!;
          q--;
        }
        bestDistances[q + 1] = distance;
        bestIds[q + 1] = city;
        count++;
      } else {
        const worstDistance = bestDistances[K - 1]!;
        const worstId = bestIds[K - 1]!;
        if (distance > worstDistance || (distance === worstDistance && city > worstId)) {
          continue;
        }
        let q = K - 2;
        while (
          q >= 0 &&
          (bestDistances[q]! > distance ||
            (bestDistances[q] === distance && bestIds[q]! > city))
        ) {
          bestDistances[q + 1] = bestDistances[q]!;
          bestIds[q + 1] = bestIds[q]!;
          q--;
        }
        bestDistances[q + 1] = distance;
        bestIds[q + 1] = city;
      }
    }

    const offset = i * K;
    for (let p = 0; p < count; p++) ids[offset + p] = bestIds[p]!;
    counts[i] = count;
  }

  return { ids, counts };
}

function buildInitialTour(
  xs: Int32Array,
  ys: Int32Array,
  n: number,
  candidates: CandidateLists,
): Int32Array {
  const parent = new Int32Array(n);
  const sizes = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    sizes[i] = 1;
  }

  function find(city: number): number {
    let root = city;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[city] !== city) {
      const nextCity = parent[city]!;
      parent[city] = root;
      city = nextCity;
    }
    return root;
  }

  function unite(a: number, b: number): void {
    let rootA = find(a);
    let rootB = find(b);
    if (rootA === rootB) return;
    if (sizes[rootA]! < sizes[rootB]!) {
      const swap = rootA;
      rootA = rootB;
      rootB = swap;
    }
    parent[rootB] = rootA;
    sizes[rootA] = sizes[rootA]! + sizes[rootB]!;
  }

  const ids = candidates.ids;
  const counts = candidates.counts;
  let edgeCount = 0;
  for (let i = 0; i < n; i++) edgeCount += counts[i]!;
  const edgeU = new Int32Array(edgeCount);
  const edgeV = new Int32Array(edgeCount);
  const edgeDistance = new Float64Array(edgeCount);
  let m = 0;

  for (let i = 0; i < n; i++) {
    const offset = i * K;
    const count = counts[i]!;
    for (let p = 0; p < count; p++) {
      const j = ids[offset + p]!;
      if (i >= j) continue;
      const dx = xs[j]! - xs[i]!;
      const dy = ys[j]! - ys[i]!;
      edgeU[m] = i;
      edgeV[m] = j;
      edgeDistance[m] = dx * dx + dy * dy;
      m++;
    }
  }

  const order = new Int32Array(m);
  for (let i = 0; i < m; i++) order[i] = i;
  order.sort((a, b) => {
    const difference = edgeDistance[a]! - edgeDistance[b]!;
    if (difference !== 0) return difference;
    const uDifference = edgeU[a]! - edgeU[b]!;
    if (uDifference !== 0) return uDifference;
    return edgeV[a]! - edgeV[b]!;
  });

  const degree = new Int32Array(n);
  const nb1 = new Int32Array(n);
  const nb2 = new Int32Array(n);
  nb1.fill(-1);
  nb2.fill(-1);

  function addEdge(a: number, b: number): void {
    if (nb1[a] === -1) nb1[a] = b;
    else nb2[a] = b;
    if (nb1[b] === -1) nb1[b] = a;
    else nb2[b] = a;
    degree[a] = degree[a]! + 1;
    degree[b] = degree[b]! + 1;
  }

  let added = 0;
  for (let p = 0; p < m && added < n - 1; p++) {
    const edge = order[p]!;
    const a = edgeU[edge]!;
    const b = edgeV[edge]!;
    if (degree[a]! >= 2 || degree[b]! >= 2) continue;
    if (find(a) === find(b)) continue;
    unite(a, b);
    addEdge(a, b);
    added++;
  }

  const endpoints = new Int32Array(n);
  const roots = new Int32Array(n);
  while (added < n - 1) {
    let endpointCount = 0;
    for (let i = 0; i < n; i++) {
      if (degree[i]! < 2) {
        endpoints[endpointCount] = i;
        roots[endpointCount] = find(i);
        endpointCount++;
      }
    }

    let bestDistance = Infinity;
    let bestA = -1;
    let bestB = -1;
    for (let p = 0; p < endpointCount; p++) {
      const a = endpoints[p]!;
      const rootA = roots[p]!;
      for (let q = p + 1; q < endpointCount; q++) {
        if (rootA === roots[q]!) continue;
        const b = endpoints[q]!;
        const dx = xs[b]! - xs[a]!;
        const dy = ys[b]! - ys[a]!;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestA = a;
          bestB = b;
        }
      }
    }

    unite(bestA, bestB);
    addEdge(bestA, bestB);
    added++;
  }

  if (n === 1) return new Int32Array([0]);

  if (n === 2) return new Int32Array([0, 1]);

  let endpointA = -1;
  let endpointB = -1;
  for (let i = 0; i < n; i++) {
    if (degree[i]! < 2) {
      if (endpointA === -1) endpointA = i;
      else if (endpointB === -1) endpointB = i;
    }
  }
  if (endpointA !== -1 && endpointB !== -1) {
    addEdge(endpointA, endpointB);
  }

  const tour = new Int32Array(n);
  tour[0] = 0;
  let previous = 0;
  let current = nb1[0]!;
  for (let step = 1; step < n; step++) {
    tour[step] = current;
    const a = nb1[current]!;
    const b = nb2[current]!;
    const following = a !== previous ? a : b;
    previous = current;
    current = following;
  }
  return tour;
}

function distance(xs: Int32Array, ys: Int32Array, a: number, b: number): number {
  const dx = xs[a]! - xs[b]!;
  const dy = ys[a]! - ys[b]!;
  return Math.sqrt(dx * dx + dy * dy);
}

function twoOpt(
  tour: Int32Array,
  pos: Int32Array,
  xs: Int32Array,
  ys: Int32Array,
  n: number,
  candidates: CandidateLists,
): void {
  const ids = candidates.ids;
  const counts = candidates.counts;

  for (let pass = 0; pass < 30; pass++) {
    let passMoved = false;
    for (let a = 0; a < n; a++) {
      let moved = true;
      while (moved) {
        moved = false;
        const posA = pos[a]!;
        const successorA = tour[posA + 1 < n ? posA + 1 : 0]!;
        const oldA = distance(xs, ys, a, successorA);
        const offset = a * K;
        const count = counts[a]!;

        for (let p = 0; p < count; p++) {
          const c = ids[offset + p]!;
          if (c === a || c === successorA) continue;
          const posC = pos[c]!;
          const successorC = tour[posC + 1 < n ? posC + 1 : 0]!;
          if (successorC === a) continue;

          const gain =
            oldA +
            distance(xs, ys, c, successorC) -
            distance(xs, ys, a, c) -
            distance(xs, ys, successorA, successorC);
          if (gain <= 1e-9) continue;

          let left = Math.min(posA, posC) + 1;
          let right = Math.max(posA, posC);
          const reverseLeft = left;
          const reverseRight = right;
          while (left < right) {
            const temporary = tour[left]!;
            tour[left] = tour[right]!;
            tour[right] = temporary;
            left++;
            right--;
          }
          for (let i = reverseLeft; i <= reverseRight; i++) {
            pos[tour[i]!] = i;
          }

          moved = true;
          passMoved = true;
          break;
        }
      }
    }
    if (!passMoved) break;
  }
}

function orOpt(
  tour: Int32Array,
  pos: Int32Array,
  xs: Int32Array,
  ys: Int32Array,
  n: number,
  candidates: CandidateLists,
): void {
  const ids = candidates.ids;
  const counts = candidates.counts;
  const remainingTour = new Int32Array(n);
  const segment = new Int32Array(3);

  for (let pass = 0; pass < 8; pass++) {
    let passMoved = false;
    for (let start = 1; start <= n - 2; start++) {
      for (let length = 1; length <= 3; length++) {
        if (start + length >= n) break;

        const previous = tour[start - 1]!;
        const first = tour[start]!;
        const last = tour[start + length - 1]!;
        const nextCity = tour[start + length]!;
        const removalGain =
          distance(xs, ys, previous, first) +
          distance(xs, ys, last, nextCity) -
          distance(xs, ys, previous, nextCity);
        if (removalGain <= 1e-9) continue;

        let bestGain = 1e-9;
        let bestCity = -1;
        let bestReverse = false;
        const offset = first * K;
        const count = counts[first]!;

        for (let p = 0; p < count; p++) {
          const c = ids[offset + p]!;
          const posC = pos[c]!;
          if (posC >= start && posC < start + length) continue;
          const successorC = c === previous
            ? nextCity
            : tour[posC + 1 < n ? posC + 1 : 0]!;

          const currentCost = distance(xs, ys, c, successorC);
          const forwardCost =
            distance(xs, ys, c, first) +
            distance(xs, ys, last, successorC) -
            currentCost;
          const forwardGain = removalGain - forwardCost;
          if (forwardGain > bestGain) {
            bestGain = forwardGain;
            bestCity = c;
            bestReverse = false;
          }

          const reverseCost =
            distance(xs, ys, c, last) +
            distance(xs, ys, first, successorC) -
            currentCost;
          const reverseGain = removalGain - reverseCost;
          if (reverseGain > bestGain) {
            bestGain = reverseGain;
            bestCity = c;
            bestReverse = true;
          }
        }

        if (bestCity === -1) continue;

        for (let s = 0; s < length; s++) segment[s] = tour[start + s]!;
        let remainingCount = 0;
        for (let i = 0; i < n; i++) {
          if (i < start || i >= start + length) remainingTour[remainingCount++] = tour[i]!;
        }

        const posBest = pos[bestCity]!;
        const bestIndex = posBest < start ? posBest : posBest - length;
        const insertion = bestIndex + 1;
        for (let i = 0; i < insertion; i++) tour[i] = remainingTour[i]!;
        for (let s = 0; s < length; s++) {
          tour[insertion + s] = bestReverse ? segment[length - 1 - s]! : segment[s]!;
        }
        for (let i = insertion; i < remainingCount; i++) tour[i + length] = remainingTour[i]!;
        for (let i = 0; i < n; i++) pos[tour[i]!] = i;

        passMoved = true;
      }
    }
    if (!passMoved) break;
  }
}

function tourLength(tour: Int32Array, xs: Int32Array, ys: Int32Array, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = tour[i]!;
    const b = tour[i + 1 < n ? i + 1 : 0]!;
    total += distance(xs, ys, a, b);
  }
  return total;
}

function iteratedLocalSearch(
  tour: Int32Array,
  pos: Int32Array,
  xs: Int32Array,
  ys: Int32Array,
  n: number,
  candidates: CandidateLists,
): Int32Array {
  let bestTour = tour.slice();
  let bestPos = pos.slice();
  let bestLength = tourLength(bestTour, xs, ys, n);
  if (n < 4) return bestTour;

  const rounds = n <= 2000 ? 12 : n <= 5000 ? 8 : 4;
  let state = 0x9e3779b9;
  const random = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };

  const working = new Int32Array(n);
  const workingPos = new Int32Array(n);

  for (let round = 0; round < rounds; round++) {
    const a = 1 + Math.floor(random() * (n - 3));
    const b = a + 1 + Math.floor(random() * (n - 2 - a));
    const c = b + 1 + Math.floor(random() * (n - 1 - b));
    let index = 0;
    for (let i = 0; i < a; i++) working[index++] = bestTour[i]!;
    for (let i = b; i < c; i++) working[index++] = bestTour[i]!;
    for (let i = a; i < b; i++) working[index++] = bestTour[i]!;
    for (let i = c; i < n; i++) working[index++] = bestTour[i]!;
    for (let i = 0; i < n; i++) workingPos[working[i]!] = i;

    twoOpt(working, workingPos, xs, ys, n, candidates);
    orOpt(working, workingPos, xs, ys, n, candidates);
    twoOpt(working, workingPos, xs, ys, n, candidates);

    const length = tourLength(working, xs, ys, n);
    if (length < bestLength) {
      bestLength = length;
      bestTour = working.slice();
      bestPos = workingPos.slice();
    }
  }

  tour.set(bestTour);
  pos.set(bestPos);
  return bestTour;
}

function solve(xs: Int32Array, ys: Int32Array, n: number): Int32Array {
  if (n <= 1) return new Int32Array(n);
  const candidates = buildCandidates(xs, ys, n);
  let tour = buildInitialTour(xs, ys, n, candidates);
  const pos = new Int32Array(n);
  for (let i = 0; i < n; i++) pos[tour[i]!] = i;
  twoOpt(tour, pos, xs, ys, n, candidates);
  orOpt(tour, pos, xs, ys, n, candidates);
  tour = iteratedLocalSearch(tour, pos, xs, ys, n, candidates);
  return tour;
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const inputFiles = readdirSync(INPUT_DIR).filter((name) => name.endsWith('.txt')).sort();
for (const name of inputFiles) {
  const { n, xs, ys } = readInstance(join(INPUT_DIR, name));
  const tour = solve(xs, ys, n);
  const outputName = name.replace(/\.txt$/, '.tour');
  writeFileSync(join(OUTPUT_DIR, outputName), `${Array.from(tour).join('\n')}\n`);
}
