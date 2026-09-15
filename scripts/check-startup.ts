import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const execute=promisify(execFile);
async function main(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'trellis-startup-test-'));
 const dataDirectory=path.join(temp,'data');
 const env={...process.env,DATA_DIR:dataDirectory};
 try{
  await execute(process.execPath,['--import','tsx','-e',"require('./src/db/index.ts')"],{env});
  await assert.rejects(fs.stat(dataDirectory),{code:'ENOENT'},'Importing a route must not create a database');
  const workers=await Promise.all(Array.from({length:8},()=>execute(process.execPath,['--import','tsx','-e',"const {getState}=require('./src/lib/store.ts');const state=getState();console.log(JSON.stringify({workspaces:state.workspaces.length,cards:state.cards.length}));require('./src/db/index.ts').sqlite.close();"],{env})));
  for(const worker of workers)assert.deepEqual(JSON.parse(worker.stdout),{workspaces:2,cards:13});
  console.log('PASS: module imports do not open SQLite; eight simultaneous first connections initialize and seed one consistent database.');
 }finally{await fs.rm(temp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
