import fs from 'node:fs';
import assert from 'node:assert/strict';
import {packageName,latestStable,compareVersions} from './tcgc_watch.mjs';

const {inputs}=JSON.parse(fs.readFileSync('tcgc.json','utf8'));
const latest=latestStable({versions:Object.fromEntries(inputs.versions.map(version=>[version,{}]))});
const current=inputs.package.devDependencies[packageName];
assert(compareVersions(latest,current)<=0);
const expected={latest_stable:latest,current,decision:'noop',writes:[]};
let result=expected;
if(process.env.ARM==='agent'){
  const calls=fs.readFileSync('evidence/tools.jsonl','utf8').trim().split('\n').map(JSON.parse);
  assert(calls.every(row=>!row.error));
  assert.deepEqual([...new Set(calls.slice(0,-1).map(row=>row.args.name))].sort(),['package','versions']);
  assert.equal(calls.at(-1).name,'publish_result');
  result=JSON.parse(calls.at(-1).args.body);
}
assert.deepEqual(result,expected);
fs.writeFileSync('evidence/result.json',JSON.stringify(result));
