import fs from 'node:fs';
import crypto from 'node:crypto';
export const packageName='@azure-tools/typespec-client-generator-core';
export function versionParts(value){
  if(typeof value!=='string'||! /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.test(value))throw Error('Expected exact stable semantic version: '+value);
  return value.split('+')[0].split('.').map(BigInt);
}
export function compareVersions(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<3;i++){if(x[i]>y[i])return 1;if(x[i]<y[i])return -1;}return 0;}
export function latestStable(metadata){
  const versions=Object.keys(metadata.versions??{}).filter(v=>!v.includes('-'));
  if(!versions.length)return null;
  for(const v of versions)versionParts(v);
  return versions.sort(compareVersions).at(-1);
}
export function findDuplicate(issues,version){
  const escaped=version.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=new RegExp('\\b(?:bump|upgrad(?:e|ing))\\s+TCGC\\s+to\\s+'+escaped+'(?![0-9A-Za-z.+-])','i');
  return issues.find(i=>!i.pull_request&&i.labels.some(l=>(typeof l==='string'?l:l.name)==='emitter:client:csharp')&&pattern.test((i.title??'')+'\n'+(i.body??'')));
}
export async function watchTcgc({github,context}){
  if(context.repo.owner!=='mohanad-hafez'||context.repo.repo!=='typespec-version-watch')throw Error('Owned fork only');
  fs.mkdirSync('tcgc-evidence',{recursive:true});
  const result={status:'reading',writes:[],captured_at:new Date().toISOString(),run_id:context.runId,downstream_upgrade_agent_retained:true};
  const save=()=>fs.writeFileSync('tcgc-evidence/result.json',JSON.stringify(result,null,2));save();
  try{
    const url='https://registry.npmjs.org/@azure-tools/typespec-client-generator-core';
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('Registry HTTP '+response.status);
    const raw=await response.text();fs.writeFileSync('tcgc-evidence/registry.json',raw);
    result.registry={url,sha256:crypto.createHash('sha256').update(raw).digest('hex')};
    result.latest_stable=latestStable(JSON.parse(raw));
    const current=await github.rest.repos.getContent({owner:'microsoft',repo:'typespec',path:'packages/http-client-csharp/package.json'});
    const bytes=Buffer.from(current.data.content,'base64');fs.writeFileSync('tcgc-evidence/package.json',bytes);
    result.current={repository:'microsoft/typespec',path:current.data.path,blob:current.data.sha,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),version:JSON.parse(bytes).devDependencies?.[packageName]};
    if(!result.latest_stable){result.status='noop';result.reason='No stable registry version';save();return;}
    if(compareVersions(result.latest_stable,result.current.version)<=0){result.status='noop';result.reason='Current version is at least the latest stable registry version';save();return;}
    const issues=await github.paginate(github.rest.issues.listForRepo,{...context.repo,state:'all',per_page:100});
    fs.writeFileSync('tcgc-evidence/issues.json',JSON.stringify(issues.map(i=>({number:i.number,state:i.state,title:i.title,body:i.body,labels:i.labels,pull_request:i.pull_request})),null,2));
    const duplicate=findDuplicate(issues,result.latest_stable);
    if(duplicate){result.status='noop';result.reason='Equivalent open or closed issue exists';result.duplicate=duplicate.number;save();return;}
    result.status='handoff_adapter_required';result.reason='New version requires issue creation plus configured Copilot/model assignment; adapter is not yet validated. No partial tracking issue was created.';save();throw Error(result.reason);
  }catch(e){if(result.status==='reading'){result.status='inspection_error';result.error={message:e.message,status:e.status};save();}throw e;}
}
