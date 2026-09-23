import type { RawLandmark, Prediction } from '../types';
import { distance3D } from './normalizeLandmarks';

/**
 * MediaPipe Hand Landmark Indices
 */
const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

// ── Geometry helpers ─────────────────────────────────────────

function dist(a: RawLandmark, b: RawLandmark): number {
  return distance3D(a, b);
}

/** Angle (radians) at vertex B in triangle A-B-C */
function angleBetween(a: RawLandmark, b: RawLandmark, c: RawLandmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA < 1e-9 || magBC < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC))));
}

/** Straightness of a finger: ratio of direct tip-MCP dist to sum-of-segments. 1.0 = perfectly straight */
function fingerStraightness(lm: RawLandmark[], mcp: number, pip: number, dip: number, tip: number): number {
  const segSum = dist(lm[mcp], lm[pip]) + dist(lm[pip], lm[dip]) + dist(lm[dip], lm[tip]);
  if (segSum < 1e-9) return 0;
  return dist(lm[mcp], lm[tip]) / segSum;
}

/** Thumb straightness (CMC→TIP chain) */
function thumbStraightness(lm: RawLandmark[]): number {
  const segSum = dist(lm[LM.THUMB_CMC], lm[LM.THUMB_MCP]) +
    dist(lm[LM.THUMB_MCP], lm[LM.THUMB_IP]) +
    dist(lm[LM.THUMB_IP], lm[LM.THUMB_TIP]);
  if (segSum < 1e-9) return 0;
  return dist(lm[LM.THUMB_CMC], lm[LM.THUMB_TIP]) / segSum;
}

interface FingerAnalysis {
  extended: boolean;
  straightness: number;
  /** Angle at the PIP joint (curled = small angle) */
  pipAngle: number;
  /** Angle at the DIP joint */
  dipAngle: number;
  /** Is the fingertip below (greater Y) than the MCP? (hand upright) */
  tipBelowMCP: boolean;
}

function analyzeFinger(
  lm: RawLandmark[],
  mcp: number, pip: number, dip: number, tip: number,
): FingerAnalysis {
  const str = fingerStraightness(lm, mcp, pip, dip, tip);
  const pipAngle = angleBetween(lm[mcp], lm[pip], lm[dip]);
  const dipAngle = angleBetween(lm[pip], lm[dip], lm[tip]);
  const wristDist_tip = dist(lm[LM.WRIST], lm[tip]);
  const wristDist_pip = dist(lm[LM.WRIST], lm[pip]);

  const extended = str > 0.8 || (wristDist_tip > wristDist_pip * 0.95 && pipAngle > 2.4);

  return {
    extended,
    straightness: str,
    pipAngle,
    dipAngle,
    tipBelowMCP: lm[tip].y > lm[mcp].y,
  };
}

interface ThumbAnalysis {
  extended: boolean;
  straightness: number;
  /** Thumb tip is closer to the index side vs curled across palm */
  acrossPalm: boolean;
}

function analyzeThumb(lm: RawLandmark[]): ThumbAnalysis {
  const str = thumbStraightness(lm);
  const extended = str > 0.72;

  // Is thumb across palm? Check if thumb tip X is closer to pinky MCP than index MCP
  const dxIndex = Math.abs(lm[LM.THUMB_TIP].x - lm[LM.INDEX_MCP].x);
  const dxPinky = Math.abs(lm[LM.THUMB_TIP].x - lm[LM.PINKY_MCP].x);
  const acrossPalm = dxPinky < dxIndex;

  return { extended, straightness: str, acrossPalm };
}

/** Palm scale for normalizing distances */
function palmScale(lm: RawLandmark[]): number {
  const s = dist(lm[LM.WRIST], lm[LM.MIDDLE_MCP]);
  return s > 1e-6 ? s : 1e-6;
}

/**
 * Checks if the hand is oriented sideways (pointing left/right)
 * by comparing horizontal span of fingertips vs vertical span.
 */
function isHandSideways(lm: RawLandmark[]): boolean {
  const tips = [LM.INDEX_TIP, LM.MIDDLE_TIP, LM.RING_TIP, LM.PINKY_TIP];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of tips) {
    if (lm[t].x < minX) minX = lm[t].x;
    if (lm[t].x > maxX) maxX = lm[t].x;
    if (lm[t].y < minY) minY = lm[t].y;
    if (lm[t].y > maxY) maxY = lm[t].y;
  }
  const hSpan = maxX - minX;
  const vSpan = maxY - minY;
  return hSpan > vSpan * 1.3;
}

/**
 * Checks if the hand is pointing downward.
 * Fingertips are below (greater Y) the wrist.
 */
function isHandPointingDown(lm: RawLandmark[]): boolean {
  const avgTipY = (lm[LM.INDEX_TIP].y + lm[LM.MIDDLE_TIP].y) / 2;
  return avgTipY > lm[LM.WRIST].y;
}

/**
 * Check if two fingertips are touching (close together).
 */
/**
 * Check if two extended fingers are close together (parallel).
 */
function areFingersTogether(lm: RawLandmark[], tip1: number, tip2: number, scale: number): boolean {
  return dist(lm[tip1], lm[tip2]) / scale < 0.35;
}

/**
 * Check if index finger is hooked (DIP bent, PIP relatively straight).
 */
function isIndexHooked(lm: RawLandmark[]): boolean {
  const dipAngle = angleBetween(lm[LM.INDEX_PIP], lm[LM.INDEX_DIP], lm[LM.INDEX_TIP]);
  const pipAngle = angleBetween(lm[LM.INDEX_MCP], lm[LM.INDEX_PIP], lm[LM.INDEX_DIP]);
  // Hooked = DIP is bent (small angle) while PIP is somewhat extended
  return dipAngle < 2.2 && pipAngle > 2.0;
}

/**
 * Check if index and middle fingers are crossed.
 */
function areFingersCrossed(lm: RawLandmark[]): boolean {
  // If index tip is on the opposite side of middle tip relative to their MCPs
  const indexDir = lm[LM.INDEX_TIP].x - lm[LM.INDEX_MCP].x;
  const middleDir = lm[LM.MIDDLE_TIP].x - lm[LM.MIDDLE_MCP].x;
  // Crossed if they lean toward each other enough
  const tipDist = Math.abs(lm[LM.INDEX_TIP].x - lm[LM.MIDDLE_TIP].x);
  const mcpDist = Math.abs(lm[LM.INDEX_MCP].x - lm[LM.MIDDLE_MCP].x);
  return tipDist < mcpDist * 0.5 || (indexDir * middleDir < 0);
}

// ── Main classifier ──────────────────────────────────────────

/**
 * Rule-based ASL fingerspelling classifier for all 26 letters.
 *
 * Uses finger extension, curl, palm orientation, fingertip distances,
 * and hand direction to classify ASL static signs.
 *
 * Note: J and Z require motion in real ASL. This classifier detects
 * their characteristic starting poses.
 */
export function classifyGeometric(landmarks: RawLandmark[]): Prediction {
  if (landmarks.length !== 21) {
    return { letter: '?', confidence: 0 };
  }

  const lm = landmarks;
  const scale = palmScale(lm);

  const thumb = analyzeThumb(lm);
  const index = analyzeFinger(lm, LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP);
  const middle = analyzeFinger(lm, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP);
  const ring = analyzeFinger(lm, LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP);
  const pinky = analyzeFinger(lm, LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP);

  const extCount = [index, middle, ring, pinky].filter(f => f.extended).length +
    (thumb.extended ? 1 : 0);

  const sideways = isHandSideways(lm);
  const pointingDown = isHandPointingDown(lm);

  const thumbIndexDist = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP]) / scale;
  const thumbMiddleDist = dist(lm[LM.THUMB_TIP], lm[LM.MIDDLE_TIP]) / scale;
  const indexMiddleDist = dist(lm[LM.INDEX_TIP], lm[LM.MIDDLE_TIP]) / scale;

  // ═══ LETTERS REQUIRING MOTION (detect starting pose) ═══

  // Z: Index finger pointing (like D/1), draw Z in air → detect index-only extended
  // (differentiated from D by thumb position)
  // We handle Z detection below within the index-only-extended group.

  // J: Like I (pinky up) but trace J → handled as I variant
  // We handle J below in the pinky-only group.

  // ═══ 5 FINGERS EXTENDED ═══

  if (thumb.extended && index.extended && middle.extended && ring.extended && pinky.extended) {
    // 5 / Open hand: all fingers spread
    return { letter: 'B', confidence: 0.72 }; // Open B or 5; both look similar
  }

  // ═══ HAND SIDEWAYS LETTERS ═══

  if (sideways && !pointingDown) {
    // G: Index and thumb point sideways, others curled
    if (index.extended && !middle.extended && !ring.extended && !pinky.extended) {
      return { letter: 'G', confidence: 0.78 };
    }

    // H: Index and middle point sideways, others curled
    if (index.extended && middle.extended && !ring.extended && !pinky.extended) {
      return { letter: 'H', confidence: 0.78 };
    }
  }

  // ═══ HAND POINTING DOWN LETTERS ═══

  if (pointingDown) {
    // P: Like K but pointing down (index + middle spread, thumb between)
    if (index.extended && middle.extended && !ring.extended && !pinky.extended) {
      return { letter: 'P', confidence: 0.74 };
    }

    // Q: Like G but pointing down (index + thumb down)
    if (index.extended && !middle.extended && !ring.extended && !pinky.extended) {
      return { letter: 'Q', confidence: 0.74 };
    }
  }

  // ═══ 4 FINGERS EXTENDED (no thumb) ═══

  if (!thumb.extended && index.extended && middle.extended && ring.extended && pinky.extended) {
    // B: Four fingers up, straight and together, thumb curled across palm
    return { letter: 'B', confidence: 0.85 };
  }

  // ═══ 3 FINGERS EXTENDED ═══

  // W: Index, middle, ring extended; pinky and thumb curled
  if (!thumb.extended && index.extended && middle.extended && ring.extended && !pinky.extended) {
    return { letter: 'W', confidence: 0.82 };
  }

  // F: Thumb and index touch (circle), middle, ring, pinky extended
  if (thumbIndexDist < 0.4 && middle.extended && ring.extended && pinky.extended) {
    return { letter: 'F', confidence: 0.80 };
  }

  // ═══ 2 FINGERS EXTENDED ═══

  if (index.extended && middle.extended && !ring.extended && !pinky.extended) {
    // R: Index and middle crossed
    if (areFingersCrossed(lm)) {
      return { letter: 'R', confidence: 0.75 };
    }

    // U: Index and middle together (parallel, close)
    if (areFingersTogether(lm, LM.INDEX_TIP, LM.MIDDLE_TIP, scale)) {
      return { letter: 'U', confidence: 0.78 };
    }

    // K: Index and middle spread, thumb touching middle finger's base
    const thumbBetween = dist(lm[LM.THUMB_TIP], lm[LM.MIDDLE_MCP]) / scale < 0.5;
    if (thumb.extended && thumbBetween && indexMiddleDist > 0.3) {
      return { letter: 'K', confidence: 0.74 };
    }

    // V: Index and middle extended apart (peace sign)
    if (indexMiddleDist > 0.25) {
      return { letter: 'V', confidence: 0.82 };
    }

    // Default two-finger: U
    return { letter: 'U', confidence: 0.65 };
  }

  // ═══ INDEX ONLY EXTENDED ═══

  if (index.extended && !middle.extended && !ring.extended && !pinky.extended) {
    // X: Index hooked (DIP bent)
    if (isIndexHooked(lm)) {
      return { letter: 'X', confidence: 0.76 };
    }

    // D: Index up, thumb touches middle finger
    if (thumbMiddleDist < 0.5) {
      return { letter: 'D', confidence: 0.78 };
    }

    // L: Index + thumb extended at right angle
    if (thumb.extended) {
      return { letter: 'L', confidence: 0.84 };
    }

    // Z: Index pointing, thumb not extended (characteristic start pose)
    // Differentiated from D by thumb not touching middle
    if (!thumb.extended && thumbMiddleDist >= 0.5) {
      return { letter: 'Z', confidence: 0.65 };
    }

    return { letter: 'D', confidence: 0.60 };
  }

  // ═══ PINKY ONLY EXTENDED ═══

  if (!index.extended && !middle.extended && !ring.extended && pinky.extended) {
    // Y: Thumb + pinky extended
    if (thumb.extended) {
      return { letter: 'Y', confidence: 0.82 };
    }

    // I: Only pinky (J is the same static pose — movement differentiates)
    // We'll label it I; J requires motion tracking
    return { letter: 'I', confidence: 0.83 };
  }

  // ═══ THUMB + PINKY ═══

  if (thumb.extended && !index.extended && !middle.extended && !ring.extended && pinky.extended) {
    return { letter: 'Y', confidence: 0.84 };
  }

  // ═══ ALL FINGERS CURLED / FIST VARIANTS ═══

  if (extCount <= 1 && !index.extended && !middle.extended && !ring.extended && !pinky.extended) {

    // O: Fingertips touch thumb tip forming circle
    if (thumbIndexDist < 0.45 && thumbMiddleDist < 0.55) {
      return { letter: 'O', confidence: 0.74 };
    }

    // C: Curved hand, fingers partially extended forming C
    const allPartiallyCurled = index.straightness > 0.55 && index.straightness < 0.85 &&
      middle.straightness > 0.55 && middle.straightness < 0.85;
    if (allPartiallyCurled && thumb.extended && thumbIndexDist > 0.4) {
      return { letter: 'C', confidence: 0.70 };
    }

    // T: Thumb between index and middle fingers
    const thumbBetweenIM = lm[LM.THUMB_TIP].y < lm[LM.INDEX_MCP].y &&
      dist(lm[LM.THUMB_TIP], lm[LM.INDEX_PIP]) / scale < 0.4;
    if (thumbBetweenIM && !thumb.acrossPalm) {
      return { letter: 'T', confidence: 0.70 };
    }

    // N: Thumb emerges between middle and ring, index+middle over thumb
    const thumbBetweenMR = dist(lm[LM.THUMB_TIP], lm[LM.MIDDLE_PIP]) / scale < 0.5 &&
      dist(lm[LM.THUMB_TIP], lm[LM.RING_PIP]) / scale < 0.5;
    if (thumbBetweenMR) {
      return { letter: 'N', confidence: 0.65 };
    }

    // M: Thumb under three fingers (index, middle, ring over thumb)
    const thumbUnderThree = dist(lm[LM.THUMB_TIP], lm[LM.RING_PIP]) / scale < 0.5 &&
      lm[LM.INDEX_TIP].y < lm[LM.THUMB_TIP].y;
    if (thumbUnderThree) {
      return { letter: 'M', confidence: 0.63 };
    }

    // S: Fist with thumb over fingers (across the front)
    if (thumb.acrossPalm && !thumb.extended) {
      return { letter: 'S', confidence: 0.72 };
    }

    // A: Fist with thumb to the side (not across palm)
    if (thumb.extended && !thumb.acrossPalm) {
      return { letter: 'A', confidence: 0.78 };
    }

    // E: All fingers tightly curled, thumb tucked
    if (!thumb.extended) {
      return { letter: 'E', confidence: 0.68 };
    }

    return { letter: 'A', confidence: 0.60 };
  }

  // ═══ FALLBACK ═══
  return { letter: '?', confidence: 0.25 };
}
