import { attachCodexJob, claimCodexJob, listCodexJobs, updateCodexJob } from '../src/lib/integrations';

function output(value:unknown){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
const [command='list',id,value,...message]=process.argv.slice(2);

try{
  if(command==='list')output({jobs:listCodexJobs()});
  else if(command==='claim'){if(!id||!value)throw new Error('Usage: ai:queue -- claim <jobId> <threadId>');output(claimCodexJob(id,value));}
  else if(command==='attach'){if(!id||!value)throw new Error('Usage: ai:queue -- attach <jobId> <threadId>');output(attachCodexJob(id,value));}
  else if(command==='update'){if(!id||!value)throw new Error('Usage: ai:queue -- update <jobId> <running|completed|failed> [message]');output(updateCodexJob(id,value,message.join(' ')||null));}
  else throw new Error('Use list, claim, or update.');
}catch(error){process.stderr.write(`${error instanceof Error?error.message:'Queue command failed.'}\n`);process.exitCode=1;}
