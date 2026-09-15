import { sqlite, dataDirectory } from '../src/db';
import fs from 'node:fs/promises';
import path from 'node:path';
async function main(){
 const destination=process.argv[2]||path.join(dataDirectory,'backups',new Date().toISOString().replace(/[:.]/g,'-'));
 await fs.mkdir(destination,{recursive:true});
 await sqlite.backup(path.join(destination,'trellis.sqlite'));
 const uploads=path.join(dataDirectory,'uploads');
 try{await fs.cp(uploads,path.join(destination,'uploads'),{recursive:true});}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 console.log(`Backup saved to ${path.resolve(destination)}`);
 sqlite.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;});
