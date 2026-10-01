import { WORD_SIGNS, type RawLandmark, type WordSign } from '../types';

export { WORD_SIGNS };

export const WORD_EMOJIS: Record<WordSign, string> = {
  Hi: '👋',
  Okay: '👌',
  Yes: '👍',
  No: '🚫',
  Stop: '✋',
  Wait: '⏳',
  Nice: '😊',
  To: '➡️',
  Meet: '🤝',
  You: '👉',
  Clear: '♻️',
};

export const WORD_DESCRIPTIONS: Record<WordSign, string> = {
  Hi: 'Open hand with fingers extended & thumb spread wide',
  Okay: 'O-ring contact with thumb and index tips',
  Yes: 'Curled fist with thumb pointing upward',
  No: 'Fist with thumb resting horizontally outwards',
  Stop: 'Flat open palm with thumb tucked across',
  Wait: 'Index finger pointing up, thumb tucked',
  Nice: 'Index, middle, and ring extended upward',
  To: 'Index and middle held close together upright',
  Meet: 'Index and middle split apart in a V-shape',
  You: 'Index finger pointing forward with thumb raised',
  Clear: 'Pinky and thumb up (clears the sentence)',
};

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Classifies hand landmarks into whole-word sign proxies from Sign2Connect.
 */
export function classifyWord(landmarks: RawLandmark[]): WordSign | null {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const indexPip = landmarks[6];
  const indexMcp = landmarks[5];
  const middleTip = landmarks[12];
  const middlePip = landmarks[10];
  const ringTip = landmarks[16];
  const ringPip = landmarks[14];
  const ringMcp = landmarks[13];
  const pinkyTip = landmarks[20];
  const pinkyPip = landmarks[18];
  const pinkyMcp = landmarks[17];

  const palmWidth = dist(indexMcp, pinkyMcp) || 0.001;
  const ext = (tip: RawLandmark, pip: RawLandmark) => dist(tip, wrist) > dist(pip, wrist) * 1.05;

  const index = ext(indexTip, indexPip);
  const middle = ext(middleTip, middlePip);
  const ring = ext(ringTip, ringPip);
  const pinky = ext(pinkyTip, pinkyPip);

  const thumbSpread = dist(thumbTip, pinkyMcp) / palmWidth;
  const thumbTucked = dist(thumbTip, ringMcp) / palmWidth < 0.55;
  const thumbUp = thumbTip.y < indexMcp.y - 0.02;
  const thumbNearIndexTip = dist(thumbTip, indexTip) / palmWidth < 0.35;
  const indexMiddleGap = dist(indexTip, middleTip) / palmWidth;

  const allCurled = !index && !middle && !ring && !pinky;
  const allExtended = index && middle && ring && pinky;

  // Clear sign: Pinky up and thumb up, remaining fingers curled
  if (pinky && thumbUp && !index && !middle && !ring) return 'Clear';

  // Hi: All 4 fingers extended, thumb up and wide spread
  if (allExtended && thumbUp && thumbSpread > 0.9) return 'Hi';

  // Okay: Thumb and index forming ring, middle, ring, pinky extended
  if (thumbNearIndexTip && !index && middle && ring && pinky) return 'Okay';

  // Yes: Fist with thumb pointed up
  if (allCurled && thumbUp && !thumbTucked) return 'Yes';

  // No: Fist with thumb out to the side
  if (allCurled && !thumbTucked && thumbSpread > 0.85 && !thumbUp) return 'No';

  // Stop: All fingers extended, thumb tucked
  if (allExtended && thumbTucked) return 'Stop';

  // Wait: Index pointing up, thumb tucked
  if (index && !middle && !ring && !pinky && thumbTucked) return 'Wait';

  // Nice: Index, middle, and ring extended, pinky curled
  if (index && middle && ring && !pinky) return 'Nice';

  // To: Index and middle close together upright
  if (index && middle && !ring && !pinky && indexMiddleGap <= 0.35) return 'To';

  // Meet: Index and middle separated upright
  if (index && middle && !ring && !pinky && indexMiddleGap > 0.35) return 'Meet';

  // You: Index extended, thumb up, other fingers curled
  if (index && !middle && !ring && !pinky && thumbUp) return 'You';

  return null;
}
