import type Database from 'better-sqlite3';

export function seed(sqlite: Database.Database) {
  sqlite.transaction(() => {
    if ((sqlite.prepare('SELECT count(*) AS n FROM workspaces').get() as { n: number }).n) return;
    const now = Date.now();
    sqlite.prepare('INSERT INTO workspaces VALUES (?,?,?,?,?)').run('workspace-studio', 'Studio', 'S', '#7c68d8', now);
    sqlite.prepare('INSERT INTO workspaces VALUES (?,?,?,?,?)').run('workspace-personal', 'Personal', 'P', '#5aa59c', now);
    const b = sqlite.prepare('INSERT INTO boards VALUES (?,?,?,?,?,?,?)');
    b.run('board-product', 'workspace-studio', 'Product roadmap', 'A little clarity for the next big thing.', '#f2f3f7', 1, now);
    b.run('board-design', 'workspace-studio', 'Design studio', 'Ideas, explorations, and the details that make a difference.', '#f1f4f1', 1, now + 1);
    b.run('board-launch', 'workspace-studio', 'Launch checklist', 'Everything we need for a thoughtful launch.', '#f7f1eb', 0, now + 2);
    b.run('board-personal', 'workspace-personal', 'Life, organized', 'Make room for what matters.', '#edf3f6', 0, now + 3);
    const c = sqlite.prepare('INSERT INTO columns VALUES (?,?,?,?,?,?,?)');
    const columnRows = [
      ['col-backlog','board-product','Backlog',0,null,'off','#a1a8b8'],
      ['col-progress','board-product','In progress',1,4,'strict','#9579dc'],
      ['col-review','board-product','In review',2,3,'warning','#e2b763'],
      ['col-done','board-product','Done',3,null,'off','#68af93'],
      ['col-design-ideas','board-design','Ideas',0,null,'off','#a1a8b8'],
      ['col-design-work','board-design','In the studio',1,4,'warning','#9579dc'],
      ['col-design-ready','board-design','Ready to share',2,null,'off','#68af93'],
      ['col-launch-todo','board-launch','To do',0,null,'off','#a1a8b8'],
      ['col-launch-doing','board-launch','In motion',1,3,'strict','#9579dc'],
      ['col-launch-done','board-launch','Ready',2,null,'off','#68af93'],
      ['col-personal-todo','board-personal','Someday',0,null,'off','#a1a8b8'],
      ['col-personal-doing','board-personal','This week',1,3,'warning','#9579dc'],
      ['col-personal-done','board-personal','Done',2,null,'off','#68af93'],
    ];
    for (const row of columnRows) c.run(...row);
    const tag = sqlite.prepare('INSERT INTO tags VALUES (?,?,?,?)');
    for (const [id,name,color] of [['tag-design','Design','#e9dff8'],['tag-feature','Feature','#dceade'],['tag-research','Research','#dce9f8'],['tag-ux','UX','#f7e7d1'],['tag-priority','Priority','#f7dcda'],['tag-content','Content','#e6e2fa']]) tag.run(id,'workspace-studio',name,color);
    const card = sqlite.prepare('INSERT INTO cards (id,workspace_id,card_number,title,description,cover,due_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
    const place = sqlite.prepare('INSERT INTO placements (id,card_id,board_id,column_id,position) VALUES (?,?,?,?,?)');
    const ct = sqlite.prepare('INSERT INTO card_tags VALUES (?,?)');
    const rows: {id:string;title:string;description:string;column:string;tags:string[];cover?:string;due?:string}[] = [
      {id:'card-onboarding',title:'Rethink the onboarding experience',description:'## A warmer welcome\nLet’s make the first five minutes feel effortless.\n\n- [x] Map the current journey\n- [ ] Sketch three directions\n- [ ] Test with five new users\n\n**Goal:** help people find their first small win.',column:'col-backlog',tags:['tag-ux','tag-research']},
      {id:'card-mobile',title:'Explore mobile navigation',description:'Explore a compact navigation pattern that makes switching boards feel natural on smaller screens.\n\nConsider **one-handed use**, generous touch targets, and an always-accessible tray.',column:'col-backlog',tags:['tag-design'],cover:'linear-gradient(135deg, #dbe8dc 0%, #b0c9b7 50%, #718e80 100%)'},
      {id:'card-search',title:'Make finding things feel effortless',description:'Add workspace search across card titles and descriptions. Start with a fast, focused experience and helpful empty states.',column:'col-backlog',tags:['tag-feature']},
      {id:'card-feedback',title:'Gather early community feedback',description:'Talk to the people who use the product every day. Collect patterns, not just feature requests.\n\n- [ ] Send interview invitations\n- [ ] Capture recurring themes',column:'col-backlog',tags:['tag-research'],due:'2026-09-20'},
      {id:'card-system',title:'Build a calmer design system',description:'## Small details. A big difference.\nA shared visual language for our next chapter.\n\n- [x] Color foundations\n- [x] Type scale\n- [ ] Component library\n- [ ] Motion principles\n\n> Good design makes room for the work.',column:'col-progress',tags:['tag-design','tag-priority'],cover:'linear-gradient(125deg, #d5c7ef 0%, #ece4f7 40%, #b59dd6 100%)'},
      {id:'card-tray',title:'Take your cards with you',description:'## Meet the card tray\nCollect a card, switch boards, and drop it where it belongs.\n\nChoose **Move** to relocate it or **Link** to create a synchronized appearance on another board.\n\nThe original stays safe until the drop succeeds.',column:'col-progress',tags:['tag-feature','tag-ux'],due:'2026-09-18'},
      {id:'card-shortcuts',title:'Little shortcuts, better flow',description:'Make everyday actions accessible from the keyboard. Include clear focus states and helpful menu alternatives to drag and drop.',column:'col-progress',tags:['tag-feature']},
      {id:'card-settings',title:'Workspace settings, simplified',description:'Bring workspace details and board preferences into one clear, focused experience.',column:'col-review',tags:['tag-ux','tag-design']},
      {id:'card-voice',title:'Find our voice',description:'Warm, clear, and useful. Create a short writing guide for product copy.\n\n**Try:** “You’re all caught up.”\n\n**Avoid:** generic success messages.',column:'col-review',tags:['tag-content'],cover:'linear-gradient(140deg, #f1dbbc, #e7c5a0 48%, #c99472)'},
      {id:'card-foundation',title:'Lay the foundations',description:'The essentials are in place: workspaces, boards, cards, and a home for every idea.',column:'col-done',tags:['tag-feature']},
      {id:'card-discovery',title:'Discovery & direction',description:'A focused product that helps thoughtful teams move forward together.',column:'col-done',tags:['tag-research']},
    ];
    rows.forEach((row,i) => {card.run(row.id,'workspace-studio',i+1,row.title,row.description,row.cover||null,row.due||null,now+i,now+i);place.run(`placement-${row.id}` ,row.id,'board-product',row.column,i);for(const t of row.tags)ct.run(row.id,t);});
    place.run('placement-system-design','card-system','board-design','col-design-work',0);
    place.run('placement-voice-design','card-voice','board-design','col-design-ideas',0);
    place.run('placement-feedback-launch','card-feedback','board-launch','col-launch-todo',0);
    card.run('card-moodboard','workspace-studio',rows.length+1,'A fresh perspective','Collect visual inspiration for our next chapter.\n\nThink natural textures, quiet confidence, and plenty of breathing room.','linear-gradient(140deg,#c5d8dc,#eef2e8 55%,#aec6b8)',null,now,now);
    place.run('placement-moodboard','card-moodboard','board-design','col-design-ideas',1);ct.run('card-moodboard','tag-design');
    card.run('card-weekend','workspace-personal',1,'Plan a slow weekend','A walk, a good book, and something homemade.',null,null,now,now);
    place.run('placement-weekend','card-weekend','board-personal','col-personal-doing',0);
    sqlite.prepare('INSERT INTO links VALUES (?,?,?,?)').run('link-design','card-system','Design principles','https://www.nngroup.com/articles/ten-usability-heuristics/');
    sqlite.prepare('INSERT INTO tray VALUES (?,?,?,?,?,?)').run('tray-mobile','workspace-studio','placement-card-mobile','move',1,0);
  }).immediate();
}
