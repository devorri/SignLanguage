# Landmark Model Training

The downloaded `asl_alphabet_train` folder is suitable for static A-Z training. It also contains `del`, `nothing`, and `space`; the first training pass intentionally uses only `A` through `Z` because the React classifier currently expects 26 outputs.

Install the training-only dependencies from the project root:

```powershell
python -m pip install -r training/requirements.txt
```

Train and export the model:

```powershell
python training/train_landmark_model.py --data-dir asl_alphabet_train --output-dir public/model --cache training/landmarks.npz --epochs 25
```

The script uses the same 63-value wrist-relative landmark representation as the browser app. It caches MediaPipe extraction so later training runs do not need to process all images again. `J` and `Z` still need the browser motion classifier because this image dataset contains static frames rather than stroke sequences.

Keep `asl_alphabet_train`, `training/landmarks.npz`, and `asl_alphabet_test` out of the production bundle. Only the exported `public/model/model.json` and weight shards belong in the web app.