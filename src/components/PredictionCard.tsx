import type { AppMode, WordSign } from '../types';
import { WORD_EMOJIS } from '../ml/wordClassifier';

interface PredictionCardProps {
  mode: AppMode;
  letter: string;
  confidence: number;
  isDetecting: boolean;
  holdProgress: number;
  transcript: Array<{ sign: string; time: string }>;
  sentenceWords: WordSign[];
  currentWord: WordSign | null;
  wordProgress: number;
  wordHint: string;
  onClearSentence: () => void;
  onClearTranscript: () => void;
  onSpeak: () => void;
  isLocked: boolean;
}

export function PredictionCard({
  mode,
  letter,
  confidence,
  isDetecting,
  holdProgress,
  transcript,
  sentenceWords,
  currentWord,
  wordProgress,
  wordHint,
  onClearSentence,
  onClearTranscript,
  onSpeak,
  isLocked,
}: PredictionCardProps) {
  const isWordMode = mode === 'words';
  const confidencePercent = Math.round(confidence * 100);
  const hasLetter = letter && letter !== '?' && letter !== '';
  const hasSentence = sentenceWords.length > 0;

  const canSpeak = isWordMode ? hasSentence || Boolean(currentWord) : Boolean(hasLetter);

  return (
    <div className="panel output-panel">
      <div className="output-head">
        {isWordMode ? 'Recognized words & sentence' : 'Recognized sign'}
      </div>

      <div className="recognized">
        {isWordMode ? (
          /* Word Mode Display */
          <div className="word-mode-display">
            {hasSentence ? (
              <div className="sentence-container">
                <div className="sentence-tokens">
                  {sentenceWords.map((word, idx) => (
                    <span className="sentence-token" key={`${word}-${idx}`}>
                      <span className="token-emoji">{WORD_EMOJIS[word] || ''}</span>
                      <span className="token-word">{word}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="letter-display mono" style={{ fontSize: '2.4rem' }}>
                {currentWord ? `${WORD_EMOJIS[currentWord] || ''} ${currentWord}` : '—'}
              </div>
            )}

            {currentWord && (
              <div className="in-progress-word-badge">
                <span className="badge-pulse" />
                <span>Reading sign: <strong>{WORD_EMOJIS[currentWord]} {currentWord}</strong></span>
              </div>
            )}

            <div className="hint">
              {wordHint || (isDetecting ? 'Hold sign steady to add to sentence.' : 'Start the camera and show a sign to begin.')}
            </div>

            {isDetecting && wordProgress > 0 && (
              <div className="read-progress" aria-label={`${Math.round(wordProgress * 100)} percent read`}>
                <div className="read-progress-fill" style={{ width: `${wordProgress * 100}%` }} />
              </div>
            )}
          </div>
        ) : (
          /* Alphabet Mode Display */
          <>
            <div className={`letter-display ${hasLetter ? 'letter-pop' : ''}`} key={letter || 'empty'}>
              {hasLetter ? letter : '—'}
            </div>

            <div className="hint">
              {hasLetter
                ? isLocked
                  ? 'Letter read and locked'
                  : 'Recognized just now'
                : isDetecting
                  ? holdProgress > 0
                    ? `Reading sign... ${Math.ceil((1 - holdProgress) * 3)}s`
                    : 'Hold one sign still for 3 seconds.'
                  : 'Start the camera and show a sign to begin.'}
            </div>

            {!hasLetter && isDetecting && holdProgress > 0 && (
              <div className="read-progress" aria-label={`${Math.round(holdProgress * 100)} percent read`}>
                <div className="read-progress-fill" style={{ width: `${holdProgress * 100}%` }} />
              </div>
            )}

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
          </>
        )}

        <div className="output-actions">
          <button
            className="btn btn-ghost speak-btn"
            disabled={!canSpeak}
            onClick={onSpeak}
          >
            🔊 Speak it
          </button>

          {isWordMode && hasSentence && (
            <button
              className="btn btn-ghost clear-sentence-btn"
              onClick={onClearSentence}
              title="Reset the current sentence"
            >
              ♻️ Clear sentence
            </button>
          )}
        </div>
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
