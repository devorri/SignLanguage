import { useRef, useState, useEffect } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { ModelStatus } from '../types';

interface UseHandLandmarkerReturn {
  handLandmarker: HandLandmarker | null;
  status: ModelStatus;
  error: string | null;
}

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

/**
 * Hook to initialize the MediaPipe HandLandmarker.
 *
 * Uses VIDEO mode (synchronous detectForVideo) rather than LIVE_STREAM
 * for simpler integration with requestAnimationFrame and React state.
 */
export function useHandLandmarker(): UseHandLandmarkerReturn {
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [status, setStatus] = useState<ModelStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setStatus('loading');

        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

        if (cancelled) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setHandLandmarker(landmarker);
        setStatus('ready');
        console.log('[MediaPipe] HandLandmarker initialized successfully');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load hand detection model';
        console.error('[MediaPipe] Initialization error:', err);
        setError(message);
        setStatus('error');
      }
    }

    init();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
          setHandLandmarker(null);
      }
    };
  }, []);

  return {
    handLandmarker,
    status,
    error,
  };
}
