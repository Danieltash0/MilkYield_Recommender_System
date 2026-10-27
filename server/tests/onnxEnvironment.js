// Jest runs each test file in its own sandbox with its own typed-array classes,
// and onnxruntime-node rejects a Float32Array that is not the real Node one
// ("data must be a Float32Array"). This environment hands the sandbox the real
// classes so model tests see what production sees.
const { TestEnvironment } = require('jest-environment-node');

const SHARED = [
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array'
];

class OnnxEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    SHARED.forEach((name) => {
      if (globalThis[name]) this.global[name] = globalThis[name];
    });
  }
}

module.exports = OnnxEnvironment;
