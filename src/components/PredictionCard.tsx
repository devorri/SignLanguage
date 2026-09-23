interface PredictionCardProps {
  letter: string;
  confidence: number;
  isDetecting: boolean;
  transcript: Array<{ sign: string; time: string }>;
  onClearTranscript: () => void;
  onSpeak: () => void;
  isLocked: boolean;
}

export function PredictionCard({
  letter,
  confidence,
  isDetecting,
  transcript,
  onClearTranscript,
  onSpeak,
  isLocked,
}: PredictionCardProps) {
  const confidencePercent = Math.round(confidence * 100);
  const hasLetter = letter && letter !== '?' && letter !== '';

  return (
    <div className="panel output-panel">
      <div className="output-head">Recognized sign</div>

      <div className="recognized">
        <div className={`letter-display ${hasLetter ? 'letter-pop' : ''}`} key={letter || 'empty'}>
          {hasLetter ? letter : '—'}
        </div>

        <div className="hint">
          {hasLetter
            ? isLocked ? 'Letter locked' : 'Recognized just now'
            : isDetecting
              ? 'Show a sign to begin detecting.'
              : 'Start the camera and show a sign to begin.'}
        </div>

        {/* Confidence bar */}
        {hasLetter && (
          <div className="confidence-section">
            <div className="confidence-header">
              <span className="confidence-label">Confidence</span>
              <span className="confidence-value">{confidencePercent}%</span>
            </div>
            <div className="confidence-track">
              <div
                className="confidence-fill"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
          </div>
        )}

        <button
          className="btn btn-ghost"
          disabled={!hasLetter}
          onClick={onSpeak}
        >
          🔊 Speak it
        </button>
      </div>

      {/* Transcript */}
      <div className="transcript">
        <h3>Transcript</h3>
        {transcript.length > 0 ? (
          <ul>
            {transcript.map((entry, i) => (
              <li key={i}>
                <span>{entry.sign}</span>
                <time>{entry.time}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="transcript-empty">Nothing recognized yet.</p>
        )}
        {transcript.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={onClearTranscript}
            style={{ marginTop: '10px', fontSize: '0.82rem', padding: '8px 16px' }}
          >
            Clear transcript
          </button>
        )}
      </div>
    </div>
  );
}
