import type { Prediction } from '../types';

interface DenseLayer {
  kernel: number[][];
  bias: number[];
}

interface BrowserModel {
  format: 'dense-mlp-v1';
  labels: string[];
  layers: DenseLayer[];
}

/**
 * TensorFlow.js-based classifier for ASL fingerspelling.
 *
 * This is a template/loader that can be used when a trained model
 * (model.json + weight files) is available in /public/model/.
 *
 * The model expects a 63-element input vector (21 landmarks × 3 coords)
 * produced by normalizeLandmarks() and outputs softmax probabilities
 * across 26 classes (A–Z).
 *
 * Usage:
 *   1. Train a model (e.g., a small MLP or 1D-CNN) on normalized landmark data
 *   2. Export to TensorFlow.js format (model.json + shard files)
 *   3. Place in /public/model/
 *   4. The loader will pick it up automatically
 */

const EXPECTED_INPUT_SIZE = 63;
let model: BrowserModel | null = null;
let loadAttempted = false;

/**
 * Lazily loads TensorFlow.js and the model.
 * Returns true if a model was successfully loaded.
 */
export async function loadTfjsModel(modelPath = '/model/asl_landmarks.json'): Promise<boolean> {
  if (loadAttempted) return model !== null;
  loadAttempted = true;

  try {
    const response = await fetch(modelPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const candidate = await response.json() as BrowserModel;
    if (candidate.format !== 'dense-mlp-v1' || candidate.layers.length !== 3) {
      throw new Error('Unsupported ASL model format');
    }

    model = candidate;
    console.log('[ASL] Local landmark model loaded successfully');
    return true;
  } catch {
    console.warn('[ASL] No local landmark model found at', modelPath, '— using geometric classifier fallback');
    model = null;
    return false;
  }
}

/**
 * Classifies normalized hand landmarks using the TF.js model.
 *
 * @param normalizedPoints - Float32Array of 63 values from normalizeLandmarks()
 * @returns Prediction with letter and confidence, or null if no model loaded
 */
export function classifyWithModel(normalizedPoints: Float32Array): Prediction | null {
  if (!model || normalizedPoints.length !== EXPECTED_INPUT_SIZE) return null;

  let values = Array.from(normalizedPoints);
  for (const [layerIndex, layer] of model.layers.entries()) {
    const output = layer.bias.map((bias, outputIndex) => {
      let value = bias;
      for (let inputIndex = 0; inputIndex < values.length; inputIndex++) {
        value += values[inputIndex] * layer.kernel[inputIndex][outputIndex];
      }
      return layerIndex < model!.layers.length - 1 ? Math.max(0, value) : value;
    });
    values = output;
  }

  const maxLogit = Math.max(...values);
  const probabilities = values.map(value => Math.exp(value - maxLogit));
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  const normalizedProbabilities = probabilities.map(value => value / total);
  const maxIdx = normalizedProbabilities.indexOf(Math.max(...normalizedProbabilities));

  return {
    letter: model.labels[maxIdx] ?? '?',
    confidence: normalizedProbabilities[maxIdx] ?? 0,
  };
}

/**
 * Returns whether a TF.js model is currently loaded and ready.
 */
export function isModelLoaded(): boolean {
  return model !== null;
}
