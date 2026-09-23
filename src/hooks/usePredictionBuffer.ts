import { useRef, useState, useCallback } from 'react';
import type { Prediction } from '../types';

interface UsePredictionBufferReturn {
  /** The smoothed/stable letter to display */
  stableLetter: string;
  /** The smoothed confidence score */
  stableConfidence: number;
  /** The raw (unsmoothed) latest prediction */
  rawPrediction: Prediction | null;
  /** Push a new prediction into the buffer */
  pushPrediction: (prediction: Prediction) => void;
  /** Clear the buffer (e.g., when hand is lost) */
  clearBuffer: () => void;
  isLocked: boolean;
  holdProgress: number;
}

const HOLD_DURATION_MS = 3000;

/**
 * Requires the same candidate to remain visible for three seconds before
 * committing it. This gives the user time to form and hold a handshape.
 */
export function usePredictionBuffer(): UsePredictionBufferReturn {
  const candidateRef = useRef<{ letter: string; startedAt: number; confidenceTotal: number; count: number } | null>(null);
  const [stableLetter, setStableLetter] = useState<string>('');
  const [stableConfidence, setStableConfidence] = useState<number>(0);
  const [rawPrediction, setRawPrediction] = useState<Prediction | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const pushPrediction = useCallback((prediction: Prediction) => {
    setRawPrediction(prediction);
    if (!prediction.letter || prediction.letter === '?' || prediction.confidence < 0.45) {
      candidateRef.current = null;
      setHoldProgress(0);
      return;
    }

    const now = performance.now();
    const candidate = candidateRef.current;
    if (!candidate || candidate.letter !== prediction.letter) {
      candidateRef.current = {
        letter: prediction.letter,
        startedAt: now,
        confidenceTotal: prediction.confidence,
        count: 1,
      };
      setHoldProgress(0);
      setStableLetter('');
      setStableConfidence(0);
      setIsLocked(false);
      return;
    }

    candidate.confidenceTotal += prediction.confidence;
    candidate.count++;
    const progress = Math.min(1, (now - candidate.startedAt) / HOLD_DURATION_MS);
    setHoldProgress(progress);

    if (progress >= 1 && candidate.letter !== stableLetter) {
      setStableLetter(candidate.letter);
      setStableConfidence(Math.round((candidate.confidenceTotal / candidate.count) * 100) / 100);
      setIsLocked(true);
    }
  }, [stableLetter]);

  const clearBuffer = useCallback(() => {
    candidateRef.current = null;
    setStableLetter('');
    setStableConfidence(0);
    setRawPrediction(null);
    setIsLocked(false);
    setHoldProgress(0);
  }, []);

  return {
    stableLetter,
    stableConfidence,
    rawPrediction,
    pushPrediction,
    clearBuffer,
    isLocked,
    holdProgress,
  };
}
