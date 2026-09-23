import type { RawLandmark } from '../types';

/**
 * MediaPipe Hand landmark connection pairs.
 */
export const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

/**
 * Draws hand skeleton on canvas matching the Sign2Connect style:
 * - Teal-bright (#4FD1C5) connections
 * - Amber (#E8A33D) landmark dots
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: RawLandmark[],
  width: number,
  height: number,
  isMirrored = true
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length === 0) {
    ctx.restore();
    return;
  }

  const points = landmarks.map(lm => ({
    x: isMirrored ? (1 - lm.x) * width : lm.x * width,
    y: lm.y * height,
  }));

  // Draw connections
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4FD1C5';
  ctx.beginPath();
  for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
    const start = points[startIdx];
    const end = points[endIdx];
    if (!start || !end) continue;
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  }
  ctx.stroke();

  // Draw landmark dots
  ctx.fillStyle = '#E8A33D';
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
