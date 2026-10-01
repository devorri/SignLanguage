import { useState, useRef, useCallback } from 'react';
import type { RawLandmark, WordSign } from '../types';
import { classifyWord, WORD_EMOJIS } from '../ml/wordClassifier';

interface UseWordSentenceOptions {
  onWordCommitted?: (word: WordSign, emoji: string) => void;
  requiredFrames?: number;
}

export function useWordSentence({ onWordCommitted, requiredFrames = 6 }: UseWordSentenceOptions = {}) {
  const [sentenceWords, setSentenceWords] = useState<WordSign[]>([]);
  const [currentWord, setCurrentWord] = useState<WordSign | null>(null);
  const [stabilityProgress, setStabilityProgress] = useState(0);
  const [hint, setHint] = useState<string>('Start the camera and show a sign to begin.');

  const lastSignRef = useRef<WordSign | null>(null);
  const stableCountRef = useRef<number>(0);
  const lastCommittedWordRef = useRef<string>('');

  const pushWordLandmarks = useCallback((landmarks: RawLandmark[]) => {
    const sign = classifyWord(landmarks);
    setCurrentWord(sign);

    if (sign) {
      if (sign === lastSignRef.current) {
        stableCountRef.current++;
      } else {
        lastSignRef.current = sign;
        stableCountRef.current = 1;
      }

      const progress = Math.min(1, stableCountRef.current / requiredFrames);
      setStabilityProgress(progress);

      if (stableCountRef.current >= requiredFrames) {
        if (sign === 'Clear') {
          setSentenceWords([]);
          setHint('Sentence cleared');
          lastCommittedWordRef.current = '';
        } else if (sign !== lastCommittedWordRef.current) {
          setSentenceWords(prev => [...prev, sign]);
          setHint(`Added "${WORD_EMOJIS[sign]} ${sign}" to sentence`);
          lastCommittedWordRef.current = sign;
          if (onWordCommitted) {
            onWordCommitted(sign, WORD_EMOJIS[sign] || '');
          }
        }
        stableCountRef.current = 0;
        setStabilityProgress(0);
      }
    } else {
      lastSignRef.current = null;
      stableCountRef.current = 0;
      setStabilityProgress(0);
    }
  }, [requiredFrames, onWordCommitted]);

  const resetWordState = useCallback(() => {
    lastSignRef.current = null;
    stableCountRef.current = 0;
    setCurrentWord(null);
    setStabilityProgress(0);
    lastCommittedWordRef.current = '';
  }, []);

  const clearSentence = useCallback(() => {
    setSentenceWords([]);
    lastCommittedWordRef.current = '';
    setHint('Sentence cleared');
  }, []);

  const removeLastWord = useCallback(() => {
    setSentenceWords(prev => prev.slice(0, -1));
    lastCommittedWordRef.current = '';
  }, []);

  return {
    sentenceWords,
    currentWord,
    stabilityProgress,
    hint,
    setHint,
    pushWordLandmarks,
    resetWordState,
    clearSentence,
    removeLastWord,
  };
}
