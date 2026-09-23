import type { Prediction, RawLandmark } from '../types';

const INDEX_TIP = 8;
const WRIST = 0;

interface Point {
  x: number;
  y: number;
}

export type MotionStatus = 'static' | 'tracking' | 'recognized';

export interface MotionResult {
  prediction: Prediction | null;
  status: MotionStatus;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const pathLength = (points: Point[]) => points.slice(1).reduce((total, point, index) => (
  total + distance(point, points[index])
), 0);

function resample(points: Point[], count: number): Point[] {
  if (points.length <= count) return points;
  const step = (points.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, index) => {
    const position = index * step;
    const lower = Math.floor(position);
    const upper = Math.min(points.length - 1, Math.ceil(position));
    const ratio = position - lower;
    return {
      x: points[lower].x + (points[upper].x - points[lower].x) * ratio,
      y: points[lower].y + (points[upper].y - points[lower].y) * ratio,
    };
  });
}

/** Detects the directional stroke of ASL J and Z from a rolling fingertip trace. */
export class MotionClassifier {
  private points: Point[] = [];
  private startedAt = 0;
  private lastResult: MotionResult = { prediction: null, status: 'static' };

  reset(): void {
    this.points = [];
    this.startedAt = 0;
    this.lastResult = { prediction: null, status: 'static' };
  }

  update(landmarks: RawLandmark[], timestamp: number): MotionResult {
    const tip = landmarks[INDEX_TIP];
    const wrist = landmarks[WRIST];
    if (!tip || !wrist) return this.lastResult;

    const point = { x: (tip.x - wrist.x), y: (tip.y - wrist.y) };
    const previous = this.points[this.points.length - 1];
    if (previous && distance(previous, point) < 0.008) return this.lastResult;

    if (this.points.length === 0) this.startedAt = timestamp;
    this.points.push(point);

    const elapsed = timestamp - this.startedAt;
    const trace = resample(this.points, 24);
    const length = pathLength(trace);
    if (elapsed < 650 || length < 0.45) {
      this.lastResult = { prediction: null, status: this.points.length > 2 ? 'tracking' : 'static' };
      return this.lastResult;
    }

    const start = trace[0];
    const end = trace[trace.length - 1];
    const xRange = Math.max(...trace.map(p => p.x)) - Math.min(...trace.map(p => p.x));
    const yRange = Math.max(...trace.map(p => p.y)) - Math.min(...trace.map(p => p.y));
    const horizontalDirection = Math.sign(trace[Math.floor(trace.length * 0.42)].x - start.x);
    const verticalDirection = Math.sign(end.y - trace[Math.floor(trace.length * 0.55)].y);

    // Z: across, diagonal back, then across again. The sign of the first
    // horizontal stroke makes this work for mirrored webcam coordinates.
    const zLike = xRange > 0.35 && yRange > 0.18 &&
      horizontalDirection !== 0 && verticalDirection !== 0 &&
      Math.abs(end.x - start.x) > 0.2;
    // J: downward stroke followed by a pronounced hook in either direction.
    const jLike = yRange > 0.45 && xRange > 0.2 &&
      Math.abs(end.x - start.x) > 0.16 && Math.abs(end.y - start.y) > 0.25;

    if (zLike || jLike) {
      const prediction: Prediction = zLike && !jLike
        ? { letter: 'Z', confidence: Math.min(0.96, 0.62 + xRange * 0.35) }
        : { letter: 'J', confidence: Math.min(0.96, 0.62 + yRange * 0.3) };
      this.lastResult = { prediction, status: 'recognized' };
      this.points = [];
      this.startedAt = 0;
      return this.lastResult;
    }

    if (elapsed > 1800 || length > 2.8) this.reset();
    this.lastResult = { prediction: null, status: 'tracking' };
    return this.lastResult;
  }
}