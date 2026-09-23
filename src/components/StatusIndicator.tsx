import type { ModelStatus, CameraStatus } from '../types';

interface StatusIndicatorProps {
  modelStatus: ModelStatus;
  cameraStatus: CameraStatus;
  isDetecting: boolean;
  motionStatus: 'static' | 'tracking' | 'recognized';
}

function getStatusConfig(modelStatus: ModelStatus, cameraStatus: CameraStatus, isDetecting: boolean, motionStatus: StatusIndicatorProps['motionStatus']) {
  if (modelStatus === 'loading') {
    return { label: 'Loading model…', dotClass: 'loading' };
  }
  if (modelStatus === 'error') {
    return { label: 'Model error', dotClass: 'error' };
  }
  if (cameraStatus === 'denied' || cameraStatus === 'error') {
    return { label: 'Camera error', dotClass: 'error' };
  }
  if (cameraStatus === 'active' && isDetecting) {
    if (motionStatus === 'tracking') return { label: 'Detecting motion…', dotClass: 'detecting' };
    if (motionStatus === 'recognized') return { label: 'Motion recognized', dotClass: 'live' };
    return { label: 'Detecting sign', dotClass: 'detecting' };
  }
  if (cameraStatus === 'active') {
    return { label: 'Watching', dotClass: 'live' };
  }
  return { label: 'Off', dotClass: '' };
}

export function StatusIndicator({ modelStatus, cameraStatus, isDetecting, motionStatus }: StatusIndicatorProps) {
  const { label, dotClass } = getStatusConfig(modelStatus, cameraStatus, isDetecting, motionStatus);

  return (
    <div className="status-pill">
      <span className={`status-dot ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}
