import { useRef, useState, useCallback, useEffect } from 'react';
import type { CameraStatus } from '../types';

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  status: CameraStatus;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

/**
 * Hook to manage webcam stream lifecycle.
 * Handles getUserMedia, permission errors, and cleanup.
 */
export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus('active');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown camera error';

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setStatus('denied');
            setError('Camera permission denied. Please allow camera access and reload.');
            break;
          case 'NotFoundError':
            setStatus('error');
            setError('No camera found. Please connect a webcam.');
            break;
          case 'OverconstrainedError':
            setStatus('error');
            setError('Camera does not meet resolution requirements.');
            break;
          default:
            setStatus('error');
            setError(message);
        }
      } else {
        setStatus('error');
        setError(message);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    isActive: status === 'active',
    status,
    error,
    startCamera,
    stopCamera,
  };
}
