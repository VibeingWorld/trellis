import { randomUUID } from 'node:crypto';
import { sqlite } from '@/db';
import { AppError } from '@/lib/errors';
import { requirePermission, type SessionUser } from '@/lib/auth';

type Row=Record<string,any>;
const clean=(value:unknown,label:string,max=300)=>{if(typeof value!=='string')throw new AppError(`${label} is required.`);const result=value.trim();if(!result||result.length>max)throw new AppError(`Enter a valid ${label.toLowerCase()}.`);return result;};
const optional=(value:unknown,max=1000)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;
const cardRow=(id:unknown)=>{const card=sqlite.prepare('SELECT * FROM cards WHERE id=? AND archived=0').get(clean(id,'Card ID',100)) as Row|undefined;if(!card)throw new AppError('Card not found.',404);return card;};
const integrationRow=(workspaceId:string)=>sqlite.prepare('SELECT * FROM workspace_integrations WHERE workspace_id=?').get(workspaceId) as Row|undefined;
function requireCardWrite(user:SessionUser,card:Row){
  requirePermission(user,card.workspace_id,'editCard');
  if(user.role==='admin')return;
  const allowed=sqlite.prepare('SELECT 1 FROM placements p JOIN boards b ON b.id=p.board_id WHERE p.card_id=? AND (b.owner_user_id=? OR EXISTS(SELECT 1 FROM board_members bm WHERE bm.board_id=b.id AND bm.user_id=?)) LIMIT 1').get(card.id,user.id,user.id);
  if(!allowed)throw new AppError('You do not have access to edit this card.',403);
}
async function github(path:string,init:RequestInit={}){
  const token=process.env.GITHUB_TOKEN;
  if(!token)throw new AppError('GitHub is not enabled on the server. Add GITHUB_TOKEN on the VPS and restart the service.',409);
  const response=await fetch(`https://api.github.com${path}`,{...init,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json',...init.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new AppError(typeof body?.message==='string'?`GitHub: ${body.message}`:'GitHub could not complete this request.',response.status===404?404:400);
  return body;
}
async function projectIdFromUrl(urlValue:string|null){
  if(!urlValue)return null;
  let url:URL;try{url=new URL(urlValue);}catch{throw new AppError('Use a complete GitHub Project URL.');}
  if(url.hostname!=='github.com')throw new AppError('The project must be on github.com.');
  const match=url.pathname.match(/^\/(orgs|users)\/([^/]+)\/projects\/(\d+)\/?$/);
  if(!match)throw new AppError('Use a GitHub Project URL such as https://github.com/orgs/acme/projects/1.');
  const [,kind,login,number]=match;
  const field=kind==='orgs'?'organization':'user';
  const query=`query($login:String!,$number:Int!){${field}(login:$login){projectV2(number:$number){id}}}`;
  const result=await github('/graphql',{method:'POST',body:JSON.stringify({query,variables:{login,number:Number(number)}})});
  const id=result?.data?.[field]?.projectV2?.id;
  if(!id)throw new AppError('That GitHub Project was not found or the server token cannot access it.',404);
  return String(id);
}
async function addIssueToProject(issueNodeId:string,projectUrl:string|null){
  const projectId=await projectIdFromUrl(projectUrl);if(!projectId)return null;
  const query='mutation($projectId:ID!,$contentId:ID!){addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){item{id}}}';
  const result=await github('/graphql',{method:'POST',body:JSON.stringify({query,variables:{projectId,contentId:issueNodeId}})});
  const errors=result?.errors;if(Array.isArray(errors)&&errors.length)throw new AppError(`GitHub Project: ${errors[0]?.message||'Could not add the issue.'}`);
  return result?.data?.addProjectV2ItemById?.item?.id||null;
}
function saveGithubLink(cardId:string,issue:Row,projectItemId:string|null){
  const now=Date.now(),existing=sqlite.prepare('SELECT id FROM github_links WHERE card_id=?').get(cardId) as {id:string}|undefined,id=existing?.id||randomUUID();
  sqlite.prepare('INSERT INTO github_links (id,card_id,issue_number,issue_node_id,issue_url,issue_title,project_item_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(card_id) DO UPDATE SET issue_number=excluded.issue_number,issue_node_id=excluded.issue_node_id,issue_url=excluded.issue_url,issue_title=excluded.issue_title,project_item_id=excluded.project_item_id,updated_at=excluded.updated_at').run(id,cardId,issue.number,issue.node_id,issue.html_url,issue.title,projectItemId,now,now);
  return{id};
}
export async function saveWorkspaceIntegration(data:Row,user:SessionUser){
  const workspaceId=clean(data.workspaceId,'Workspace ID',100);requirePermission(user,workspaceId,'manageWorkspace');
  const trigger=data.aiTriggerColumnId?clean(data.aiTriggerColumnId,'Trigger column',100):null;
  if(trigger&&!sqlite.prepare('SELECT 1 FROM columns c JOIN boards b ON b.id=c.board_id WHERE c.id=? AND b.workspace_id=?').get(trigger,workspaceId))throw new AppError('Choose a column from this workspace.');
  const githubOwner=optional(data.githubOwner,100),githubRepo=optional(data.githubRepo,100),githubProjectUrl=optional(data.githubProjectUrl,1000),codexProjectName=optional(data.codexProjectName,200);
  if(Boolean(githubOwner)!==Boolean(githubRepo))throw new AppError('Enter both the GitHub owner and repository.');
  if(githubProjectUrl)await projectIdFromUrl(githubProjectUrl);
  sqlite.prepare('INSERT INTO workspace_integrations (workspace_id,github_owner,github_repo,github_project_url,codex_project_name,ai_trigger_column_id,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET github_owner=excluded.github_owner,github_repo=excluded.github_repo,github_project_url=excluded.github_project_url,codex_project_name=excluded.codex_project_name,ai_trigger_column_id=excluded.ai_trigger_column_id,updated_at=excluded.updated_at').run(workspaceId,githubOwner,githubRepo,githubProjectUrl,codexProjectName,trigger,Date.now());
  return{ok:true};
}
export async function createGithubIssue(data:Row,user:SessionUser){
  const card=cardRow(data.cardId);requireCardWrite(user,card);const settings=integrationRow(card.workspace_id);
  if(!settings?.github_owner||!settings.github_repo)throw new AppError('Connect a GitHub repository in Workspace integrations first.',409);
  const issue=await github(`/repos/${encodeURIComponent(settings.github_owner)}/${encodeURIComponent(settings.github_repo)}/issues`,{method:'POST',body:JSON.stringify({title:card.title,body:`${card.description||''}\n\n---\nCreated from Trellis card #${card.card_number}.`.trim()})});
  const projectItemId=await addIssueToProject(issue.node_id,settings.github_project_url||null);
  return{ok:true,...saveGithubLink(card.id,issue,projectItemId),issueUrl:issue.html_url};
}
export async function linkGithubIssue(data:Row,user:SessionUser){
  const card=cardRow(data.cardId);requireCardWrite(user,card);const settings=integrationRow(card.workspace_id);
  if(!settings?.github_owner||!settings.github_repo)throw new AppError('Connect a GitHub repository in Workspace integrations first.',409);
  let url:URL;try{url=new URL(clean(data.url,'GitHub issue URL',1000));}catch{throw new AppError('Use a complete GitHub issue URL.');}
  const match=url.hostname==='github.com'&&url.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/);
  if(!match||match[1].toLowerCase()!==String(settings.github_owner).toLowerCase()||match[2].toLowerCase()!==String(settings.github_repo).toLowerCase())throw new AppError(`Use an issue from ${settings.github_owner}/${settings.github_repo}.`);
  const issue=await github(`/repos/${encodeURIComponent(settings.github_owner)}/${encodeURIComponent(settings.github_repo)}/issues/${Number(match[3])}`);
  const projectItemId=await addIssueToProject(issue.node_id,settings.github_project_url||null);
  return{ok:true,...saveGithubLink(card.id,issue,projectItemId),issueUrl:issue.html_url};
}
export function unlinkGithubIssue(data:Row,user:SessionUser){const card=cardRow(data.cardId);requireCardWrite(user,card);sqlite.prepare('DELETE FROM github_links WHERE card_id=?').run(card.id);return{ok:true};}

export function enqueueCodexJobForMove(placementId:string,columnId:string){
  const placement=sqlite.prepare('SELECT p.id,p.card_id,p.board_id,p.column_id,c.title,c.description,c.card_number,c.workspace_id,b.name board_name,col.name column_name FROM placements p JOIN cards c ON c.id=p.card_id JOIN boards b ON b.id=p.board_id JOIN columns col ON col.id=p.column_id WHERE p.id=?').get(placementId) as Row|undefined;
  if(!placement||placement.column_id!==columnId)return null;
  const settings=integrationRow(placement.workspace_id);if(!settings||settings.ai_trigger_column_id!==columnId)return null;
  if(!settings.codex_project_name)return{warning:'Choose a Codex desktop project in Workspace integrations before using the AI trigger.'};
  const existing=sqlite.prepare("SELECT id FROM ai_runs WHERE card_id=? AND status IN ('queued','claimed','running') ORDER BY created_at DESC LIMIT 1").get(placement.card_id) as {id:string}|undefined;
  if(existing)return{queued:true,runId:existing.id};
  const runId=randomUUID(),now=Date.now();sqlite.prepare('INSERT INTO ai_runs (id,card_id,placement_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(runId,placement.card_id,placement.id,'queued',now,now);
  return{queued:true,runId};
}

export function listCodexJobs(){
  return sqlite.prepare("SELECT r.id,r.status,r.created_at createdAt,c.id cardId,c.card_number cardNumber,c.title,c.description,b.id boardId,b.name boardName,col.name columnName,w.id workspaceId,w.name workspaceName,i.codex_project_name codexProjectName,g.issue_url githubIssueUrl FROM ai_runs r JOIN cards c ON c.id=r.card_id JOIN placements p ON p.id=r.placement_id JOIN boards b ON b.id=p.board_id JOIN columns col ON col.id=p.column_id JOIN workspaces w ON w.id=c.workspace_id JOIN workspace_integrations i ON i.workspace_id=w.id LEFT JOIN github_links g ON g.card_id=c.id WHERE r.status='queued' ORDER BY r.created_at").all();
}
export function claimCodexJob(id:string,threadId:string){const result=sqlite.prepare("UPDATE ai_runs SET status='claimed',codex_thread_id=?,updated_at=? WHERE id=? AND status='queued'").run(clean(threadId,'Codex task ID',200),Date.now(),clean(id,'Job ID',100));if(result.changes!==1)throw new AppError('This job was already claimed or no longer exists.',409);return{ok:true};}
export function updateCodexJob(id:string,status:string,error?:string|null){if(!['running','completed','failed'].includes(status))throw new AppError('Choose a valid job status.');const result=sqlite.prepare('UPDATE ai_runs SET status=?,error=?,updated_at=? WHERE id=?').run(status,error?String(error).slice(0,2000):null,Date.now(),clean(id,'Job ID',100));if(result.changes!==1)throw new AppError('Job not found.',404);return{ok:true};}
