// Loads the ONNX yield models trained in recommender/notebooks and runs them.
// Nothing here throws at require time: if onnxruntime-node or the model files
// are missing, isAvailable() is false and the recommender uses the moving average.
const fs = require('fs');
const path = require('path');

const FILES = { nn: 'yield_nn.onnx', lr: 'yield_lr.onnx' };

const modelsDir = () => process.env.MODELS_DIR || path.join(__dirname, '..', 'ml', 'models');

let ort; // undefined = not tried yet, null = unavailable
let meta; // same convention
const sessions = {};
let warnedSynthetic = false;

const runtime = () => {
  if (ort === undefined) {
    try {
      ort = require('onnxruntime-node');
    } catch (err) {
      console.warn('Recommender: onnxruntime-node is not installed; model predictions are off.');
      ort = null;
    }
  }
  return ort;
};

// Contents of model_meta.json, or null when it is missing or unreadable
const getMeta = () => {
  if (meta === undefined) {
    try {
      meta = JSON.parse(fs.readFileSync(path.join(modelsDir(), 'model_meta.json'), 'utf8'));
      if (!Array.isArray(meta.features) || !meta.features.length) throw new Error('model_meta.json has no features');
    } catch (err) {
      meta = null;
    }
    if (meta && meta.data_source === 'synthetic' && !warnedSynthetic) {
      warnedSynthetic = true;
      console.warn('Recommender: the ONNX models were trained on SYNTHETIC data. Retrain on farm data before relying on them.');
    }
  }
  return meta;
};

const isAvailable = (name) =>
  Boolean(FILES[name] && getMeta() && runtime() && fs.existsSync(path.join(modelsDir(), FILES[name])));

const session = async (name) => {
  if (!sessions[name]) sessions[name] = runtime().InferenceSession.create(path.join(modelsDir(), FILES[name]));
  return sessions[name];
};

// One prediction, in litres per session
const predict = async (name, features) => {
  if (!isAvailable(name)) throw new Error(`Model "${name}" is not available`);
  const expected = getMeta().features.length;
  if (!Array.isArray(features) || features.length !== expected) {
    throw new Error(`Model "${name}" needs ${expected} features, got ${features ? features.length : 0}`);
  }
  if (features.some((v) => typeof v !== 'number' || !Number.isFinite(v))) {
    throw new Error(`Model "${name}" was given a missing or non-numeric feature`);
  }
  const s = await session(name);
  const input = new ort.Tensor('float32', Float32Array.from(features), [1, features.length]);
  const output = await s.run({ [s.inputNames[0]]: input });
  return Number(output[s.outputNames[0]].data[0]);
};

// Forget loaded files (tests point MODELS_DIR elsewhere between cases)
const reset = () => {
  meta = undefined;
  warnedSynthetic = false;
  Object.keys(sessions).forEach((k) => delete sessions[k]);
};

module.exports = { FILES, modelsDir, getMeta, isAvailable, predict, reset };
