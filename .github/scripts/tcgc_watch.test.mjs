import {test} from 'node:test';
import assert from 'node:assert/strict';
import {latestStable,compareVersions,findDuplicate} from './tcgc_watch.mjs';
test('numeric precedence, prerelease exclusion and exact current syntax',()=>{assert.equal(latestStable({versions:{'0.9.9':{},'0.10.0':{},'1.0.0-dev.1':{}}}),'0.10.0');assert.equal(compareVersions('10000000000000000.1.0','9999999999999999.9.9'),1);assert.throws(()=>compareVersions('^0.73.1','0.73.1'));assert.equal(latestStable({versions:{'1.0.0-dev.1':{}}}),null);});
test('closed equivalent issues block; version-prefix and unrelated-label matches do not',()=>{const issue={number:1,state:'closed',title:'Bump TCGC to 0.73.1',labels:[{name:'emitter:client:csharp'}]};assert.equal(findDuplicate([issue],'0.73.1').number,1);assert.equal(findDuplicate([{...issue,title:'Bump TCGC to 0.73.10'}],'0.73.1'),undefined);assert.equal(findDuplicate([{...issue,labels:[]}],'0.73.1'),undefined);});
