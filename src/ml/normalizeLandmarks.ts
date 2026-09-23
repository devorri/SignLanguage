import type { RawLandmark, NormalizedLandmarks } from '../types';

/**
 * MediaPipe hand landmark indices:
 * 0: WRIST
 * 1-4: THUMB (CMC, MCP, IP, TIP)
 * 5-8: INDEX (MCP, PIP, DIP, TIP)
 * 9-12: MIDDLE (MCP, PIP, DIP, TIP)
 * 13-16: RING (MCP, PIP, DIP, TIP)
 * 17-20: PINKY (MCP, PIP, DIP, TIP)
 */

/**
 * Computes the Euclidean distance between two 3D points.
 */
function distance3D(a: RawLandmark, b: RawLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Normalizes raw MediaPipe hand landmarks to be:
 * 1. Wrist-relative (translated so wrist = origin)
 * 2. Scale-invariant (divided by wrist-to-middle-MCP distance)
 *
 * This makes the feature vector independent of:
 * - Hand position in the frame
 * - Distance from the camera
 *
 * @param landmarks - Array of 21 raw 3D landmarks from MediaPipe
 * @param handedness - Which hand was detected
 * @returns NormalizedLandmarks with a 63-element Float32Array
 */
export function normalizeLandmarks(
  landmarks: RawLandmark[],
  handedness: 'Left' | 'Right' = 'Right'
): NormalizedLandmarks {
  if (landmarks.length !== 21) {
    throw new Error(`Expected 21 landmarks, got ${landmarks.length}`);
  }

  const wrist = landmarks[0];
  const middleMCP = landmarks[9];

  // Compute scale factor: distance from wrist to middle finger MCP
  const scaleFactor = distance3D(wrist, middleMCP);

  // Avoid division by zero (hand too close or degenerate detection)
  const safeScale = scaleFactor > 1e-6 ? scaleFactor : 1e-6;

  const points = new Float32Array(63);

  for (let i = 0; i < 21; i++) {
    const lm = landmarks[i];
    // Translate to wrist-relative coordinates, then scale
    points[i * 3 + 0] = (lm.x - wrist.x) / safeScale;
    points[i * 3 + 1] = (lm.y - wrist.y) / safeScale;
    points[i * 3 + 2] = (lm.z - wrist.z) / safeScale;
  }

  return { points, handedness };
}

export { distance3D };
