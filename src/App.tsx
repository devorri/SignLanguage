import { useCallback, useRef, useState } from 'react';
import './App.css';
import { WebcamFeed } from './components/WebcamFeed';
import { PredictionCard } from './components/PredictionCard';
import { StatusIndicator } from './components/StatusIndicator';
import { GuideModal } from './components/GuideModal';
import { useWebcam } from './hooks/useWebcam';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import { usePredictionBuffer } from './hooks/usePredictionBuffer';
import { useWordSentence } from './hooks/useWordSentence';
import type { AppMode, Prediction, RawLandmark, WordSign } from './types';
import type { MotionStatus } from './ml/motionClassifier';
import { WORD_SIGNS, WORD_EMOJIS, WORD_DESCRIPTIONS } from './ml/wordClassifier';
import aslAlphabetGuide from './assets/asl-alphabet-guide.png';

function App() {
  const { videoRef, isActive, status: camStatus, error: camError, startCamera, stopCamera } = useWebcam();
  const { handLandmarker, status: modelStatus, error: modelError } = useHandLandmarker();

  const [mode, setMode] = useState<AppMode>('words');
  const [isDetecting, setIsDetecting] = useState(false);
  const [motionStatus, setMotionStatus] = useState<MotionStatus>('static');
  const [transcript, setTranscript] = useState<Array<{ sign: string; time: string }>>([]);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Alphabet mode buffer (3-second hold confirmation)
  const {
    stableLetter,
    stableConfidence,
    pushPrediction,
    clearBuffer,
    isLocked,
    holdProgress,
  } = usePredictionBuffer();

  const lastTranscriptLetterRef = useRef('');

  // Callback when a word sign is committed in word mode
  const handleWordCommitted = useCallback((word: WordSign, emoji: string) => {
    setTranscript(current => [
      {
        sign: `${emoji} ${word}`,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
      },
      ...current,
    ].slice(0, 16));
  }, []);

  // Word mode sentence builder
  const {
    sentenceWords,
    currentWord,
    stabilityProgress: wordProgress,
    hint: wordHint,
    pushWordLandmarks,
    resetWordState,
    clearSentence,
  } = useWordSentence({ onWordCommitted: handleWordCommitted });

  // Handle alphabet prediction
  const handlePrediction = useCallback((prediction: Prediction) => {
    pushPrediction(prediction);
    if (stableLetter && stableLetter !== lastTranscriptLetterRef.current) {
      lastTranscriptLetterRef.current = stableLetter;
      setTranscript(current => [
        {
          sign: `Letter ${stableLetter}`,
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
        },
        ...current,
      ].slice(0, 16));
    }
  }, [pushPrediction, stableLetter]);

  // Handle word mode frame landmarks
  const handleWordLandmarks = useCallback((landmarks: RawLandmark[]) => {
    pushWordLandmarks(landmarks);
  }, [pushWordLandmarks]);

  const handleHandLost = useCallback(() => {
    clearBuffer();
    resetWordState();
    setIsDetecting(false);
    setMotionStatus('static');
    lastTranscriptLetterRef.current = '';
  }, [clearBuffer, resetWordState]);

  const handleClearTranscript = useCallback(() => {
    lastTranscriptLetterRef.current = '';
    setTranscript([]);
  }, []);

  const handleModeChange = useCallback((newMode: AppMode) => {
    setMode(newMode);
    clearBuffer();
    resetWordState();
    lastTranscriptLetterRef.current = '';
  }, [clearBuffer, resetWordState]);

  const handleSpeak = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (mode === 'words') {
      const textToSpeak = sentenceWords.length > 0 ? sentenceWords.join(' ') : currentWord || '';
      if (textToSpeak) {
        const utter = new SpeechSynthesisUtterance(textToSpeak);
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      }
    } else {
      if (stableLetter) {
        const utter = new SpeechSynthesisUtterance(stableLetter);
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      }
    }
  }, [mode, sentenceWords, currentWord, stableLetter]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="logo" href="#studio" aria-label="Sign2Connect home">
          <img className="logo-mark" src="/logo.png" alt="Sign2Connect Logo" />
          <span>Sign2Connect</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#studio">Studio</a>
          <a href="#how">How it works</a>
          <button
            type="button"
            className="nav-guide-link"
            onClick={() => setIsGuideOpen(true)}
          >
            📖 ASL Chart
          </button>
        </nav>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <span className="eyebrow">Real-time · Runs locally in your browser</span>
        <h1 id="page-title">Turn hand signs into words, out loud.</h1>
        <p>
          Sign2Connect watches your hands through your camera and translates your signs — bridging the gap between sign and spoken language, right in your browser.
        </p>

        <div className="hero-actions-row">
          <button
            className="btn btn-primary hero-action"
            onClick={startCamera}
            disabled={isActive || modelStatus === 'loading'}
          >
            {modelStatus === 'loading'
              ? 'Loading the camera model…'
              : isActive
                ? 'Camera is active'
                : 'Start the camera'}
          </button>

          {/* Mode Switcher Tabs in Hero */}
          <div className="mode-toggle-group" role="tablist" aria-label="Recognition Mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'words'}
              className={`mode-tab-btn ${mode === 'words' ? 'active' : ''}`}
              onClick={() => handleModeChange('words')}
            >
              <span className="mode-tab-icon">💬</span>
              <span className="mode-tab-label">Word Mode</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'alphabet'}
              className={`mode-tab-btn ${mode === 'alphabet' ? 'active' : ''}`}
              onClick={() => handleModeChange('alphabet')}
            >
              <span className="mode-tab-icon">🔤</span>
              <span className="mode-tab-label">Alphabet Mode</span>
            </button>
          </div>
        </div>
      </section>

      <main id="studio" className="studio">
        <section className="panel camera-panel">
          <div className="camera-head">
            <div className="camera-title-wrap">
              <h2>Camera</h2>
              <span className="mode-pill">{mode === 'words' ? '💬 Word Mode' : '🔤 Alphabet Mode'}</span>
            </div>
            <StatusIndicator
              modelStatus={modelStatus}
              cameraStatus={camStatus}
              isDetecting={isDetecting}
              motionStatus={motionStatus}
            />
          </div>

          <WebcamFeed
            videoRef={videoRef}
            handLandmarker={handLandmarker}
            isActive={isActive}
            mode={mode}
            onPrediction={handlePrediction}
            onWordLandmarks={handleWordLandmarks}
            onHandLost={handleHandLost}
            onDetectingChange={setIsDetecting}
            onMotionStatusChange={setMotionStatus}
          />

          {(camError || modelError) && <div className="error-panel">{camError || modelError}</div>}

          <div className="controls-bar">
            {!isActive ? (
              <button className="btn btn-primary" onClick={startCamera} disabled={modelStatus === 'loading'}>
                Allow camera
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={stopCamera}>
                Stop camera
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => handleModeChange(mode === 'words' ? 'alphabet' : 'words')}
              title="Toggle between Word Sentence Builder and Alphabet Fingerspelling"
            >
              {mode === 'words' ? 'Switch to 🔤 Alphabet' : 'Switch to 💬 Word Mode'}
            </button>

            <button className="btn btn-ghost" onClick={handleClearTranscript}>
              Clear transcript
            </button>

            <button className="btn btn-ghost" onClick={() => setIsGuideOpen(true)}>
              📖 A-Z guide
            </button>
          </div>

          <div className="mode-indicator">
            {mode === 'words'
              ? '💬 Word Mode: Sign whole words (Hi, Okay, Yes, No, Stop, Wait, Nice, To, Meet, You) to construct sentences. Sign ♻️ Clear to reset.'
              : '🔤 Alphabet Mode: ASL fingerspelling A through Z. Hold static letters still for 2–3s to lock.'}
          </div>
        </section>

        <aside>
          <PredictionCard
            mode={mode}
            letter={stableLetter}
            confidence={stableConfidence}
            isDetecting={isActive && isDetecting}
            isLocked={isLocked}
            holdProgress={holdProgress}
            transcript={transcript}
            sentenceWords={sentenceWords}
            currentWord={currentWord}
            wordProgress={wordProgress}
            wordHint={wordHint}
            onClearSentence={clearSentence}
            onClearTranscript={handleClearTranscript}
            onSpeak={handleSpeak}
          />
        </aside>
      </main>

      {/* Guide / How It Works Section */}
      <section id="how" className="how" aria-labelledby="guide-title">
        {mode === 'words' ? (
          /* Words Mode Guide */
          <>
            <div className="guide-intro">
              <span className="eyebrow">Whole-Word Sign Mode</span>
              <h2 id="guide-title">Words this app recognizes</h2>
              <p>
                Signs recognized whole build into a sentence as you sign them — e.g. sign <strong>Nice → To → Meet → You</strong> to build <em>&ldquo;Nice To Meet You.&rdquo;</em> Show the <strong>Clear</strong> sign to reset.
              </p>
            </div>

            <div className="glossary word-glossary">
              {WORD_SIGNS.map((word: WordSign) => {
                const isActiveWord = currentWord === word;
                const isInSentence = sentenceWords.includes(word);
                return (
                  <div
                    className={`sign-card word-card ${isActiveWord ? 'active' : ''} ${isInSentence ? 'in-sentence' : ''}`}
                    key={word}
                  >
                    <span className="shape word-emoji">{WORD_EMOJIS[word]}</span>
                    <span className="name">{word}</span>
                    <span className="desc">{WORD_DESCRIPTIONS[word]}</span>
                  </div>
                );
              })}
            </div>
            <p className="glossary-note">
              These are simplified proxy handshapes for real-time webcam demonstration. Build sentences by signing words consecutively, and click <strong>🔊 Speak it</strong> to hear your message spoken aloud.
            </p>
          </>
        ) : (
          /* Alphabet Mode Guide */
          <>
            <div className="guide-intro">
              <span className="eyebrow">ASL fingerspelling guide</span>
              <h2 id="guide-title">Find the handshape for each letter</h2>
              <p>
                Use this quick reference while practicing in front of the camera. The highlighted card shows the letter currently recognized.
              </p>
            </div>
            <div className="guide-key" aria-label="Guide legend">
              <span>
                <i className="key-dot static" />Static handshape
              </span>
              <span>
                <i className="key-dot motion" />Motion stroke (J & Z)
              </span>
            </div>
            <figure className="alphabet-poster">
              <img
                src={aslAlphabetGuide}
                alt="American Sign Language alphabet poster showing the handshape for each letter from A to Z"
              />
              <figcaption>Visual ASL alphabet reference. J and Z use movement.</figcaption>
            </figure>
            <div className="glossary">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                <div
                  className={`sign-card ${stableLetter === letter ? 'active' : ''}`}
                  key={letter}
                >
                  <span className="shape">{letter}</span>
                  <span className="name">Letter {letter}</span>
                  <span className="desc">
                    {letter === 'J' || letter === 'Z' ? 'Motion stroke' : 'Static handshape'}
                  </span>
                </div>
              ))}
            </div>
            <p className="glossary-note">
              J and Z require a moving stroke after forming the starting handshape. Keep your hand visible and centered for the steadiest recognition.
            </p>
          </>
        )}
      </section>

      {/* ASL Alphabet Chart Quick Reference Modal */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      <footer>
        <span>Sign2Connect — processed locally in your browser. Video is never uploaded or stored.</span>
        <span>Built with MediaPipe Hands & TensorFlow.js</span>
      </footer>
    </div>
  );
}

export default App;
