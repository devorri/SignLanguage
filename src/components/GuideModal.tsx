import { useEffect } from 'react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuideModal({ isOpen, onClose }: GuideModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-card">
        <div className="modal-head">
          <h3 id="modal-title">ASL alphabet — quick reference</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close guide">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <img
            src="/asl-alphabet-chart.jpg"
            alt="American Sign Language alphabet chart quick reference showing hand signs A through Z"
            className="guide-chart-img"
          />
          <div className="guide-modal-notes">
            <p>
              <strong>Tips for best detection:</strong>
            </p>
            <ul>
              <li>Keep your hand inside the frame and face the palm towards the camera.</li>
              <li>A–Y are static handshapes. Hold still for 2–3 seconds to confirm.</li>
              <li>J & Z use movement: form the base shape, then trace the stroke.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
