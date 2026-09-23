"""Train the 26-class landmark model used by the React recognizer.

Example:
  python training/train_landmark_model.py \
    --data-dir asl_alphabet_train \
    --output-dir public/model \
    --cache training/landmarks.npz \
    --epochs 25
"""

from __future__ import annotations

import argparse
import json
import urllib.request
from pathlib import Path

import mediapipe as mp
import numpy as np
import tensorflow as tf


LABELS = tuple("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def normalize_landmarks(hand_landmarks: object) -> np.ndarray:
    points = np.asarray([[point.x, point.y, point.z] for point in hand_landmarks], dtype=np.float32)
    wrist = points[0]
    scale = np.linalg.norm(points[9] - wrist)
    scale = max(float(scale), 1e-6)
    return ((points - wrist) / scale).reshape(-1)


def extract_features(data_dir: Path, cache_path: Path, max_per_class: int = 0) -> tuple[np.ndarray, np.ndarray]:
    if cache_path.exists():
        cached = np.load(cache_path)
        return cached["features"], cached["labels"]

    features: list[np.ndarray] = []
    labels: list[int] = []
    image_paths = []
    for label_index, label in enumerate(LABELS):
        paths = [
            image_path
            for image_path in sorted((data_dir / label).iterdir())
            if image_path.suffix.lower() in IMAGE_EXTENSIONS
        ]
        if max_per_class > 0:
            paths = paths[:max_per_class]
        image_paths.extend((label_index, image_path) for image_path in paths)

    if hasattr(mp, "solutions"):
        hands_api = mp.solutions.hands
        with hands_api.Hands(static_image_mode=True, max_num_hands=1, model_complexity=1, min_detection_confidence=0.5) as hands:
            for index, (label_index, image_path) in enumerate(image_paths, start=1):
                image = cv2.imread(str(image_path))
                if image is None:
                    continue
                result = hands.process(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
                if result.multi_hand_landmarks:
                    features.append(normalize_landmarks(result.multi_hand_landmarks[0].landmark))
                    labels.append(label_index)
                if index % 1000 == 0:
                    print(f"Extracted {index}/{len(image_paths)} images")
    else:
        model_path = Path("training/hand_landmarker.task")
        if not model_path.exists():
            model_path.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                model_path,
            )
        options = mp.tasks.vision.HandLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=0.5,
        )
        with mp.tasks.vision.HandLandmarker.create_from_options(options) as landmarker:
            for index, (label_index, image_path) in enumerate(image_paths, start=1):
                image = cv2.imread(str(image_path))
                if image is None:
                    continue
                image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=image))
                if result.hand_landmarks:
                    features.append(normalize_landmarks(result.hand_landmarks[0]))
                    labels.append(label_index)
                if index % 1000 == 0:
                    print(f"Extracted {index}/{len(image_paths)} images")

    feature_array = np.asarray(features, dtype=np.float32)
    label_array = np.asarray(labels, dtype=np.int64)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache_path, features=feature_array, labels=label_array)
    print(f"Saved {len(feature_array)} detected hands to {cache_path}")
    return feature_array, label_array


def build_model() -> tf.keras.Model:
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(63,)),
        tf.keras.layers.Dense(256, activation="relu"),
        tf.keras.layers.Dropout(0.25),
        tf.keras.layers.Dense(128, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(len(LABELS), activation="softmax"),
    ])
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--cache", type=Path, default=Path("training/landmarks.npz"))
    parser.add_argument("--output-dir", type=Path, default=Path("public/model"))
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--max-per-class", type=int, default=0)
    args = parser.parse_args()

    global cv2
    import cv2

    features, labels = extract_features(args.data_dir, args.cache, args.max_per_class)
    if len(features) < 100:
        raise RuntimeError("Too few hands were detected. Check the dataset path and MediaPipe installation.")

    train_features, val_features, train_labels, val_labels = [], [], [], []
    rng = np.random.default_rng(42)
    for label_index in range(len(LABELS)):
        indices = np.flatnonzero(labels == label_index)
        rng.shuffle(indices)
        split = max(1, int(len(indices) * 0.15))
        val_indices, train_indices = indices[:split], indices[split:]
        val_features.append(features[val_indices])
        val_labels.append(labels[val_indices])
        train_features.append(features[train_indices])
        train_labels.append(labels[train_indices])

    model = build_model()
    model.fit(
        np.concatenate(train_features),
        np.concatenate(train_labels),
        validation_data=(np.concatenate(val_features), np.concatenate(val_labels)),
        epochs=args.epochs,
        batch_size=args.batch_size,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)],
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    keras_path = args.output_dir / "asl_landmarks.keras"
    model.save(keras_path)
    (args.output_dir / "labels.json").write_text(json.dumps(LABELS), encoding="utf-8")

    try:
        import tensorflowjs as tfjs
        tfjs.converters.save_keras_model(model, str(args.output_dir))
        print(f"Exported TensorFlow.js model to {args.output_dir}")
    except ImportError:
        print("TensorFlow.js converter unavailable; saved the Keras model only.")


if __name__ == "__main__":
    main()