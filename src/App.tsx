import { useCallback, useRef, useState } from 'react';
import './App.css';
import { WebcamFeed } from './components/WebcamFeed';
import { PredictionCard } from './components/PredictionCard';
import { StatusIndicator } from './components/StatusIndicator';
import { useWebcam } from './hooks/useWebcam';
import { useHandLandmarker } from './hooks/useHandLandmarker';
import { usePredictionBuffer } from './hooks/usePredictionBuffer';
import type { Prediction } from './types';
import type { MotionStatus } from './ml/motionClassifier';
import aslAlphabetGuide from './assets/asl-alphabet-guide.png';

function App() {
  const { videoRef, isActive, status: camStatus, error: camError, startCamera, stopCamera } = useWebcam();
  const { handLandmarker, status: modelStatus, error: modelError } = useHandLandmarker();
  const { stableLetter, stableConfidence, pushPrediction, clearBuffer, isLocked } = usePredictionBuffer(10, 0.5);
  const [isDetecting, setIsDetecting] = useState(false);
  const [motionStatus, setMotionStatus] = useState<MotionStatus>('static');
  const [transcript, setTranscript] = useState<Array<{ sign: string; time: string }>>([]);
  const lastTranscriptLetterRef = useRef('');

  const handlePrediction = useCallback((prediction: Prediction) => {
    pushPrediction(prediction);
    if (stableLetter && stableLetter !== lastTranscriptLetterRef.current) {
      lastTranscriptLetterRef.current = stableLetter;
      setTranscript(current => [{
        sign: stableLetter,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      }, ...current].slice(0, 12));
    }
  }, [pushPrediction, stableLetter]);

  const handleHandLost = useCallback(() => {
    clearBuffer();
    setIsDetecting(false);
    setMotionStatus('static');
    lastTranscriptLetterRef.current = '';
  }, [clearBuffer]);

  const handleClearTranscript = useCallback(() => {
    lastTranscriptLetterRef.current = '';
    setTranscript([]);
  }, []);

  const handleSpeak = useCallback(() => {
    if (stableLetter && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(stableLetter));
    }
  }, [stableLetter]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="logo" href="#studio" aria-label="Sign2Connect home"><img className="logo-mark" src="https://sign2connectofficial-oss.github.io/sign2connect/logo.png" alt="" /><span>Sign2Connect</span></a>
        <nav aria-label="Primary navigation"><a href="#studio">Studio</a><a href="#how">How it works</a></nav>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <span className="eyebrow">Real-time · Runs in your browser</span>
        <h1 id="page-title">Turn hand signs into words, out loud.</h1>
        <p>Sign2Connect watches your hands through your camera and reads out what you sign — bridging the gap between sign and spoken language, right where you’re standing.</p>
        <button className="btn btn-primary hero-action" onClick={startCamera} disabled={isActive || modelStatus === 'loading'}>{modelStatus === 'loading' ? 'Loading the camera model' : isActive ? 'Camera is on' : 'Start the camera'}</button>
      </section>

      <main id="studio" className="studio">
        <section className="panel camera-panel">
          <div className="camera-head"><h2>Camera</h2><StatusIndicator modelStatus={modelStatus} cameraStatus={camStatus} isDetecting={isDetecting} motionStatus={motionStatus} /></div>
          <WebcamFeed videoRef={videoRef} handLandmarker={handLandmarker} isActive={isActive} onPrediction={handlePrediction} onHandLost={handleHandLost} onDetectingChange={setIsDetecting} onMotionStatusChange={setMotionStatus} />
          {(camError || modelError) && <div className="error-panel">{camError || modelError}</div>}
          <div className="controls-bar">
            {!isActive ? <button className="btn btn-primary" onClick={startCamera} disabled={modelStatus === 'loading'}>Allow camera</button> : <button className="btn btn-ghost" onClick={stopCamera}>Stop camera</button>}
            <button className="btn btn-ghost" onClick={handleClearTranscript}>Clear transcript</button>
            <button className="btn btn-ghost" disabled title="Camera switching is not available yet">Switch camera</button>
            <a className="btn btn-ghost" href="#how">📖 A-Z guide</a>
          </div>
          <div className="mode-indicator">Alphabet Mode</div>
        </section>

        <aside><PredictionCard letter={stableLetter} confidence={stableConfidence} isDetecting={isActive} isLocked={isLocked} transcript={transcript} onClearTranscript={handleClearTranscript} onSpeak={handleSpeak} /></aside>
      </main>

      <section id="how" className="how" aria-labelledby="guide-title">
        <div className="guide-intro">
          <span className="eyebrow">ASL fingerspelling guide</span>
          <h2 id="guide-title">Find the handshape for each letter</h2>
          <p>Use this quick reference while practicing in front of the camera. The highlighted card shows the letter currently recognized.</p>
        </div>
        <div className="guide-key" aria-label="Guide legend">
          <span><i className="key-dot static" />Static handshape</span>
          <span><i className="key-dot motion" />Motion stroke</span>
        </div>
        <figure className="alphabet-poster">
          <img src={aslAlphabetGuide} alt="American Sign Language alphabet poster showing the handshape for each letter from A to Z" />
          <figcaption>Visual ASL alphabet reference. J and Z use movement.</figcaption>
        </figure>
        <div className="glossary">{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => <div className={`sign-card ${stableLetter === letter ? 'active' : ''}`} key={letter}><span className="shape">{letter}</span><span className="name">Letter {letter}</span><span className="desc">{letter === 'J' || letter === 'Z' ? 'Motion stroke' : 'Static handshape'}</span></div>)}</div>
        <p className="glossary-note">J and Z require a moving stroke after forming the starting handshape. Keep your hand visible and centered for the steadiest recognition.</p>
      </section>
      <footer><span>Sign2Connect — processed locally in your browser. Video is never uploaded or stored.</span><span>Built with MediaPipe Hands</span></footer>
    </div>
  );
}

export default App;
