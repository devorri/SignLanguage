import { useRef, useEffect, useCallback } from 'react';
import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { drawHandSkeleton } from './HandSkeleton';
import { normalizeLandmarks } from '../ml/normalizeLandmarks';
import { classifyGeometric } from '../ml/geometricClassifier';
import { MotionClassifier } from '../ml/motionClassifier';
import { classifyWithModel, loadTfjsModel } from '../ml/tfjsClassifier';
import type { AppMode, Prediction, RawLandmark } from '../types';

interface WebcamFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  handLandmarker: HandLandmarker | null;
  isActive: boolean;
  mode: AppMode;
  onPrediction: (prediction: Prediction) => void;
  onWordLandmarks: (landmarks: RawLandmark[]) => void;
  onHandLost: () => void;
  onDetectingChange: (isDetecting: boolean) => void;
  onMotionStatusChange: (status: 'static' | 'tracking' | 'recognized') => void;
}


export function WebcamFeed({
  videoRef,
  handLandmarker,
  isActive,
  mode,
  onPrediction,
  onWordLandmarks,
  onHandLost,
  onDetectingChange,
  onMotionStatusChange,
}: WebcamFeedProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(-1);
  const motionClassifierRef = useRef(new MotionClassifier());
  const detectRef = useRef<() => void>(() => undefined);

  const detect = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !handLandmarker || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(() => detectRef.current());
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafIdRef.current = requestAnimationFrame(() => detectRef.current());
      return;
    }

    const now = performance.now();
    if (now <= lastTimestampRef.current) {
      rafIdRef.current = requestAnimationFrame(() => detectRef.current());
      return;
    }
    lastTimestampRef.current = now;

    try {
      const result = handLandmarker.detectForVideo(video, now);

      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0] as RawLandmark[];
        onDetectingChange(true);

        // Draw hand skeleton on canvas overlay
        drawHandSkeleton(ctx, landmarks, canvas.width, canvas.height, true);

        if (mode === 'words') {
          onMotionStatusChange('static');
          onWordLandmarks(landmarks);
        } else {
          // Normalize and classify alphabet letter
          const normalized = normalizeLandmarks(landmarks, 'Right');
          const motion = motionClassifierRef.current.update(landmarks, now);
          onMotionStatusChange(motion.status);
          const staticPrediction = classifyWithModel(normalized.points) ?? classifyGeometric(landmarks);
          onPrediction(motion.prediction ?? staticPrediction);
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDetectingChange(false);
        onMotionStatusChange('static');
        onHandLost();
      }
    } catch (err) {
      console.warn('[Detection] Frame error:', err);
    }

    rafIdRef.current = requestAnimationFrame(() => detectRef.current());
  }, [handLandmarker, videoRef, mode, onPrediction, onWordLandmarks, onHandLost, onDetectingChange, onMotionStatusChange]);


  useEffect(() => {
    detectRef.current = detect;
  }, [detect]);

  useEffect(() => {
    void loadTfjsModel();
  }, []);

  useEffect(() => {
    if (isActive && handLandmarker) {
      rafIdRef.current = requestAnimationFrame(() => detectRef.current());
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isActive, handLandmarker, detect]);

  return (
    <div className="video-wrap">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} />

      {!isActive && (
        <div className="empty-state">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#5B6675" strokeWidth="1.4">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
          <p>Your camera feed will appear here. We only process it locally — nothing is uploaded.</p>
        </div>
      )}
    </div>
  );
}
