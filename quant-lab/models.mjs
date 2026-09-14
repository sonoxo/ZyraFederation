// Dimensionless educational models, not reactor physics or engineering tools.
function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(label + ' must be finite');
  return value;
}
function unit(value, label) {
  finite(value, label);
  if (value < 0 || value > 1) throw new RangeError(label + ' must be in [0,1]');
  return value;
}

/** Generic energy accounting. Fusion/fission are scenario labels ONLY.
 * Input, useful output, rejected heat and stored energy use arbitrary units.
 * No fuel, neutron, plasma, geometry, operating-limit or control parameters.
 */
export function energyStep({scenario='fusion', stored=0, input=0.5, extraction=0.25, loss=0.1, dt=1}={}) {
  if (!['fusion','fission'].includes(scenario)) throw new RangeError('Unknown scenario');
  finite(stored,'stored'); unit(input,'input'); unit(extraction,'extraction'); unit(loss,'loss');
  finite(dt,'dt');
  if (stored < 0 || dt <= 0 || dt > 1) throw new RangeError('Invalid stored energy or timestep');
  if (extraction + loss > 1) throw new RangeError('Extraction plus loss must not exceed 1');
  const supplied = input * dt;
  const available = stored + supplied;
  const useful = available * extraction * dt;
  const rejected = available * loss * dt;
  return { scenario, supplied, useful, rejected, stored: available - useful - rejected,
    units: 'arbitrary energy units', physicalPrediction: false };
}

/** Explicit 1-D diffusion with zero-flux ends; stable for ratio <= 0.5. */
export function diffusionStep(values, ratio=0.2) {
  if (!Array.isArray(values) || values.length < 3 || values.length > 10000) throw new RangeError('Use 3–10000 cells');
  values.forEach(v=>finite(v,'cell'));
  finite(ratio,'ratio');
  if (ratio < 0 || ratio > 0.5) throw new RangeError('Stable ratio range: 0–0.5');
  return values.map((v,i)=>v + ratio*((values[i-1] ?? v)-2*v+(values[i+1] ?? v)));
}

/** Ideal single-qubit Ry rotation, simulated classically. Angle in radians. */
export function qubit(theta=0) {
  finite(theta,'theta');
  const alpha = Math.cos(theta/2), beta = Math.sin(theta/2);
  return { alpha, beta, p0: alpha*alpha, p1: beta*beta, hardware: 'classical simulation' };
}
