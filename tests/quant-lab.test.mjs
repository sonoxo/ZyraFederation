import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {energyStep,diffusionStep,qubit} from '../quant-lab/models.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10);
test('both labeled scenarios conserve generic energy',()=>{
  for(const scenario of ['fusion','fission']) {
    let stored=0;
    for(let i=0;i<200;i++) {
      const r=energyStep({scenario,stored,input:0.5});
      near(stored+r.supplied,r.stored+r.useful+r.rejected);
      assert.ok(r.stored>=0);assert.equal(r.physicalPrediction,false);stored=r.stored;
    }
  }
});
test('energy validation rejects nonfinite and invalid settings',()=>{
  for(const input of [NaN,Infinity,-1,2]) assert.throws(()=>energyStep({input}));
  assert.throws(()=>energyStep({extraction:.9,loss:.9}));
  assert.throws(()=>energyStep({stored:-1}));
  assert.throws(()=>energyStep({dt:2}));
  assert.throws(()=>energyStep({scenario:'hardware'}));
});
test('zero input and no stored energy remains zero',()=>near(energyStep({input:0}).stored,0));
test('diffusion conserves total and does not introduce extrema',()=>{
  let cells=[0,0,1,0,0];
  for(let i=0;i<100;i++) {cells=diffusionStep(cells);near(cells.reduce((a,b)=>a+b,0),1);assert.ok(cells.every(v=>v>=0&&v<=1));}
});
test('diffusion rejects unstable and invalid inputs',()=>{
  assert.throws(()=>diffusionStep([0,1,0],.51));
  assert.throws(()=>diffusionStep([0,NaN,0]));
  assert.throws(()=>diffusionStep([1]));
});
test('qubit probabilities normalize and known rotations match',()=>{
  near(qubit(0).p0,1);near(qubit(Math.PI).p1,1);near(qubit(Math.PI/2).p0,.5);
  for(let t=-6;t<=6;t+=.1) near(qubit(t).p0+qubit(t).p1,1);
  assert.throws(()=>qubit(Infinity));
});
test('CLI accepts all modes and exits without hardware access',()=>{
  const run=spawnSync(process.execPath,[new URL('../quant-lab/cli.mjs',import.meta.url).pathname],{
    input:'step\nfission\nstep\ndiffusion\nstep\nquantum\n+\nstep\nreset\nquit\n',encoding:'utf8',timeout:5000});
  assert.equal(run.status,0,run.stderr);
  for(const word of ['fusion','fission','diffusion','quantum','EDUCATIONAL ONLY']) assert.ok(run.stdout.includes(word));
});
