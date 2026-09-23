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
}

/**
 * Sliding-window majority-vote prediction smoothing buffer.
 *
 * Prevents UI letter-flickering by maintaining a circular buffer of
 * recent predictions and only updating the displayed letter when
 * a clear majority is reached.
 *
 * @param bufferSize - Number of predictions to keep (default 10, ~330ms at 30fps)
 * @param threshold - Minimum frequency ratio to accept a prediction (default 0.5 = 50%)
 */
export function usePredictionBuffer(
  bufferSize = 10,
  threshold = 0.5,
): UsePredictionBufferReturn {
  const bufferRef = useRef<Prediction[]>([]);
  const [stableLetter, setStableLetter] = useState<string>('');
  const [stableConfidence, setStableConfidence] = useState<number>(0);
  const [rawPrediction, setRawPrediction] = useState<Prediction | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const pushPrediction = useCallback((prediction: Prediction) => {
    setRawPrediction(prediction);

    const buffer = bufferRef.current;

    // Push to buffer, maintain circular size
    buffer.push(prediction);
    if (buffer.length > bufferSize) {
      buffer.shift();
    }

    // Don't compute mode until buffer has enough data
    if (buffer.length < 3) return;

    // Compute majority vote
    const counts = new Map<string, { count: number; totalConfidence: number }>();
    for (const p of buffer) {
      const existing = counts.get(p.letter);
      if (existing) {
        existing.count++;
        existing.totalConfidence += p.confidence;
      } else {
        counts.set(p.letter, { count: 1, totalConfidence: p.confidence });
      }
    }

    // Find the mode (most frequent letter)
    let modeLetter = '';
    let modeCount = 0;
    let modeConfidence = 0;
    for (const [letter, { count, totalConfidence }] of counts) {
      if (count > modeCount) {
        modeLetter = letter;
        modeCount = count;
        modeConfidence = totalConfidence / count; // Average confidence
      }
    }

    const frequency = modeCount / buffer.length;
    const confidence = modeConfidence * frequency;
    // Hysteresis: a new letter must win clearly, while the current one stays
    // locked until the hand has moved away or a stronger candidate appears.
    const shouldLock = frequency >= threshold && confidence >= 0.45 && modeLetter !== '?';
    const canSwitch = !stableLetter || modeLetter === stableLetter || confidence >= stableConfidence + 0.12;
    if (shouldLock && canSwitch) {
      setStableLetter(modeLetter);
      setStableConfidence(Math.round(confidence * 100) / 100);
      setIsLocked(true);
    }
  }, [bufferSize, threshold, stableConfidence, stableLetter]);

  const clearBuffer = useCallback(() => {
    bufferRef.current = [];
    setStableLetter('');
    setStableConfidence(0);
    setRawPrediction(null);
    setIsLocked(false);
  }, []);

  return {
    stableLetter,
    stableConfidence,
    rawPrediction,
    pushPrediction,
    clearBuffer,
    isLocked,
  };
}
