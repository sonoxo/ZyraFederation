import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { energyStep, diffusionStep, qubit } from './models.mjs';

const rl = createInterface({input:stdin,output:stdout});
let mode='fusion', stored=0, level=0.5, angle=0;
let cells=[0,0,0,0,1,0,0,0,0];
console.log('⚛ GPT-QUANT-LLM | SOFTWARE LAB');
console.log('EDUCATIONAL ONLY • ARBITRARY UNITS • NO REACTOR OR QUANTUM HARDWARE');
console.log('Fusion and fission modes are generic energy-accounting scenarios, not physical models.');
console.log('Commands: fusion | fission | diffusion | quantum | + | - | step | reset | quit');
console.log('+/- changes generic input or the demonstration qubit angle. No physical haptics.');
function show() {
  if (mode==='quantum') console.log(JSON.stringify({mode,angle,...qubit(angle)},null,2));
  else if (mode==='diffusion') console.log(JSON.stringify({mode,cells,total:cells.reduce((a,b)=>a+b,0)},null,2));
  else console.log(JSON.stringify({mode,input:level,stored,units:'arbitrary'},null,2));
}
show();
try {
  for await (const raw of rl) {
    const cmd=raw.trim().toLowerCase();
    if(cmd==='quit') break;
    if(['fusion','fission','diffusion','quantum'].includes(cmd)) mode=cmd;
    else if(cmd==='+' || cmd==='-') {
      const delta=cmd==='+'?0.05:-0.05;
      level=Math.min(1,Math.max(0,level+delta)); angle+=delta*Math.PI;
    } else if(cmd==='reset') {stored=0;level=0.5;angle=0;cells=[0,0,0,0,1,0,0,0,0];}
    else if(cmd==='step') {
      if(mode==='diffusion') cells=diffusionStep(cells);
      else if(mode!=='quantum') {
        const result=energyStep({scenario:mode,stored,input:level});
        stored=result.stored;console.log(JSON.stringify(result,null,2));
      }
    } else if(cmd) console.log('Unknown command. Use step, +, -, reset, a mode name, or quit.');
    show();
  }
} finally {rl.close();}
