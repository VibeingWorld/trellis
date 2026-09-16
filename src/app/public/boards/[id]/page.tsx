import { notFound } from "next/navigation";
import { getPublicBoardState } from "@/lib/store";
import { appPath } from "@/lib/app-path";

export const dynamic = "force-dynamic";

function backgroundStyle(background:string){
  if(/^#[\da-f]{3,8}$/i.test(background)||/^(linear|radial)-gradient\(/.test(background))return{background};
  if(/^\/api\/uploads\/[\w-]+$/.test(background))return{backgroundImage:`linear-gradient(#eef3ee30,#eef3ee30),url("${appPath(background)}")`,backgroundSize:"cover",backgroundPosition:"center"};
  return{background:"#e8eee8"};
}

export default async function PublicBoardPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  let state:ReturnType<typeof getPublicBoardState>;
  try{state=getPublicBoardState(id);}catch{notFound();}
  const columns=[...state.columns].sort((a,b)=>a.position-b.position);
  return <main className="public-board-page"><section className="public-board-shell" style={backgroundStyle(state.board.background)}><header className="public-board-top"><div className="public-brand">cove<span>.</span></div><span className="public-readonly">Public · read only</span></header><div className="public-board-content"><div className="public-board-heading"><h1>{state.board.name}</h1><p>{state.board.description||`${state.workspace.name} shared this board for viewing.`}</p></div><div className="public-columns">{columns.map(column=>{const placements=state.placements.filter(item=>item.columnId===column.id).sort((a,b)=>a.position-b.position);return <section className="public-column" key={column.id}><h2>{column.name}<span>{placements.length}</span></h2><div className="public-cards">{placements.map(placement=>{const card=state.cards.find(item=>item.id===placement.cardId);if(!card)return null;const tags=state.tags.filter(tag=>state.cardTags.some(item=>item.cardId===card.id&&item.tagId===tag.id));return <article className="public-card" key={placement.id}>{tags.length>0&&<div className="public-tags">{tags.map(tag=><span key={tag.id} style={{background:tag.color}}>{tag.name}</span>)}</div>}<span className="public-card-number">#{card.cardNumber}</span><strong>{card.title}</strong>{card.description&&<p>{card.description}</p>}</article>})}{placements.length===0&&<div className="public-empty">No cards yet</div>}</div></section>})}</div></div></section></main>;
}
