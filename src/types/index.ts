export interface Prediction {
  letter: string;
  confidence: number;
}

export type AppMode = 'words' | 'alphabet';

export const WORD_SIGNS = [
  'Hi', 'Okay', 'Yes', 'No', 'Stop', 'Wait', 'Nice', 'To', 'Meet', 'You', 'Clear'
] as const;

export type WordSign = typeof WORD_SIGNS[number];

export interface WordPrediction {
  word: WordSign;
  confidence: number;
}

export interface NormalizedLandmarks {
  /** 63 values (21 landmarks × 3 coordinates: x, y, z) */
  points: Float32Array;
  handedness: 'Left' | 'Right';
}

export interface RawLandmark {
  x: number;
  y: number;
  z: number;
}

export type ModelStatus = 'loading' | 'ready' | 'error' | 'no-model';
export type CameraStatus = 'requesting' | 'active' | 'denied' | 'error' | 'idle';

export interface HandDetectionResult {
  landmarks: RawLandmark[][];
  handedness: Array<Array<{ categoryName: string; score: number }>>;
}

export interface FingerState {
  isExtended: boolean;
  curlRatio: number;
}

export interface HandGeometry {
  thumb: FingerState;
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
  /** Distance between thumb tip and index tip, normalized */
  thumbIndexDistance: number;
  /** Distance between thumb tip and middle tip, normalized */
  thumbMiddleDistance: number;
}

