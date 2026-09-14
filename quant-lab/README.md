# GPT-QUANT-LLM — educational software lab

This is a dependency-free Node.js 22+ terminal module, not a reactor, hardware controller, LLM, or quantum computer. No training or model weights are included.

## Run

```sh
node quant-lab/cli.mjs
node --test tests/*.test.mjs
```

Commands: `fusion`, `fission`, `diffusion`, `quantum`, `+`, `-`, `step`, `reset`, `quit`.

## Models and limitations

- **Fusion / fission labels:** both deliberately use the same generic energy-accounting model. They do not predict nuclear reactions or reactor behavior. An arbitrary input is divided between useful output, rejected energy and storage. There are no plasma, neutron, fuel, geometry, criticality or reactor control parameters.
- **Heat diffusion:** an ideal dimensionless one-dimensional diffusion stencil with insulated ends. The ratio is restricted to 0–0.5 for numerical stability. This is not a validated thermal design tool.
- **Quantum:** an ideal, classically calculated single-qubit Ry rotation. Probabilities are mathematical outputs, not hardware measurements; there is no claimed speedup or connection to energy production.
- **Quantitative checks:** energy accounting, diffusion conservation, input validation and probability normalization have automated tests.
- **Controls:** keyboard-operated terminal commands only. No physical tactile feedback, cybernetic interface, graphical dashboard or device connectivity is implemented.

## Patent provenance

No patents are implemented or claimed. Specific documents and claims have not been provided for this module. A future patent review must record publication number, source, relevant claims, assumptions and implementation mapping. A published patent does not establish physical feasibility, safety validation or permission to practice its claims.

No physical construction, operating instructions, weapons functionality or deployment is included. Do not use these outputs for engineering decisions.
