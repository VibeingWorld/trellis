import { createInterface } from 'node:readline';
import { sqlite } from '../db';
import { getState, mutate } from '../lib/store';
import type { SessionUser } from '../lib/auth';

type Request={jsonrpc:'2.0';id?:string|number;method:string;params?:Record<string,any>};
const tools=[
 {name:'list_workspaces',description:'List Cove workspaces the configured MCP user can read.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'list_boards',description:'List boards, optionally restricted to a workspace.',inputSchema:{type:'object',properties:{workspaceId:{type:'string'}},additionalProperties:false}},
 {name:'get_board',description:'Read a board with its columns and active cards.',inputSchema:{type:'object',properties:{boardId:{type:'string'}},required:['boardId'],additionalProperties:false}},
 {name:'create_board',description:'Create a board with starter columns.',inputSchema:{type:'object',properties:{workspaceId:{type:'string'},name:{type:'string'},description:{type:'string'}},required:['workspaceId','name'],additionalProperties:false}},
 {name:'create_column',description:'Create a column on a board.',inputSchema:{type:'object',properties:{boardId:{type:'string'},name:{type:'string'}},required:['boardId','name'],additionalProperties:false}},
 {name:'create_card',description:'Create a numbered card in a column.',inputSchema:{type:'object',properties:{columnId:{type:'string'},title:{type:'string'},description:{type:'string'}},required:['columnId','title'],additionalProperties:false}},
 {name:'update_card',description:'Update a card title, description, or due date.',inputSchema:{type:'object',properties:{cardId:{type:'string'},title:{type:'string'},description:{type:'string'},dueDate:{type:['string','null']}},required:['cardId'],additionalProperties:false}},
 {name:'move_card',description:'Move a card appearance to another column.',inputSchema:{type:'object',properties:{placementId:{type:'string'},columnId:{type:'string'}},required:['placementId','columnId'],additionalProperties:false}},
];
function actor():SessionUser{
 const requested=process.env.COVE_MCP_USER_EMAIL?.trim().toLowerCase();
 const record=(requested?sqlite.prepare('SELECT id,email,name,role,active FROM users WHERE email=? AND active=1').get(requested):sqlite.prepare("SELECT id,email,name,role,active FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1").get()) as {id:string;email:string;name:string;role:'admin'|'member';active:number}|undefined;
 if(!record)throw new Error('Complete Cove setup first, or set COVE_MCP_USER_EMAIL to an active account.');
 return{...record,active:true};
}
function text(value:unknown){return{content:[{type:'text',text:JSON.stringify(value,null,2)}]};}
function callTool(name:string,args:Record<string,any>){
 const user=actor(),state=getState(user);
 if(name==='list_workspaces')return text(state.workspaces);
 if(name==='list_boards')return text(state.boards.filter(board=>!args.workspaceId||board.workspaceId===args.workspaceId));
 if(name==='get_board'){const board=state.boards.find(item=>item.id===args.boardId);if(!board)throw new Error('Board not found or unavailable.');const columns=state.columns.filter(item=>item.boardId===board.id).sort((a,b)=>a.position-b.position);return text({board,columns:columns.map(column=>({...column,cards:state.placements.filter(item=>item.columnId===column.id).sort((a,b)=>a.position-b.position).map(placement=>({...state.cards.find(card=>card.id===placement.cardId),placementId:placement.id})).filter(card=>card.id&&!card.archived)}))});}
 if(name==='create_board')return text(mutate({action:'createBoard',...args},user));
 if(name==='create_column')return text(mutate({action:'createColumn',...args},user));
 if(name==='create_card')return text(mutate({action:'createCard',...args},user));
 if(name==='update_card'){const card=state.cards.find(item=>item.id===args.cardId);if(!card)throw new Error('Card not found or unavailable.');const {cardId,...changes}=args;return text(mutate({action:'updateCard',id:cardId,version:card.version,...changes},user));}
 if(name==='move_card'){const placement=state.placements.find(item=>item.id===args.placementId);if(!placement)throw new Error('Card placement not found or unavailable.');return text(mutate({action:'movePlacement',...args,version:placement.version},user));}
 throw new Error('Unknown tool.');
}
function send(id:string|number,result?:unknown,error?:unknown){process.stdout.write(JSON.stringify(error?{jsonrpc:'2.0',id,error}:{jsonrpc:'2.0',id,result})+'\n');}
const input=createInterface({input:process.stdin,terminal:false});
input.on('line',(line)=>{let request:Request;try{request=JSON.parse(line);}catch{return;}if(request.id===undefined)return;try{if(request.method==='initialize')send(request.id,{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'cove',version:'1.0.0'}});else if(request.method==='ping')send(request.id,{});else if(request.method==='tools/list')send(request.id,{tools});else if(request.method==='tools/call')send(request.id,callTool(request.params?.name,request.params?.arguments||{}));else send(request.id,undefined,{code:-32601,message:'Method not found'});}catch(error){send(request.id,undefined,{code:-32000,message:error instanceof Error?error.message:'Tool failed'});}});
