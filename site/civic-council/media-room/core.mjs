/* Exact-source civic media editing decisions.
 * CMS publication_occurrence remains owner. A chapter/player URL is not a
 * downloaded recording, proof of a vote, speech transcript or reuse license.
 */
export const HEADER="kind\tfile\ttitle\thref\tsource\treceipt\tobserved\trights\tassertion";
const FILE=/^\d{2}-\d{4}[A-Z]$/;
const SOURCE={agenda:"dallas-council-20260923-legistar",chapter:"dallas-council-20260923-swagit"};
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const plain=s=>String(s??"").replace(/[\x00-\x1f\t\n\r]/g," ").trim().slice(0,700);
export function urlAllowed(url,kind){
 try{const u=new URL(url);if(u.protocol!=="https:"||u.username||u.password||u.hash||u.port)return false;
  if(kind==="agenda")return u.hostname==="cityofdallas.legistar.com"&&u.pathname==="/LegislationDetail.aspx";
  if(kind==="chapter")return u.hostname==="dallastx.new.swagit.com"&&/^\/play\/402001\/[0-9]{1,8}$/.test(u.pathname)&&!u.search;
 }catch{}return false;
}
export function parseSnapshot(text){
 if(typeof text!=="string"||text.length>2500000)throw Error("Source cut exceeds the 2.5 MB public review limit.");
 const rows=text.replace(/^\uFEFF/,"").replace(/\r/g,"").split("\n").filter(x=>x&&!x.startsWith("#"));
 if(rows.shift()!==HEADER)throw Error("Native publication cut has the wrong column or type contract.");
 if(!rows.length||rows.length>5000)throw Error("Source must have 1–5000 occurrence rows.");
 const seen=new Set();
 return rows.map((line,index)=>{
  const cols=line.split("\t");if(cols.length!==9)throw Error("Invalid source cut at row "+(index+2));
  const [kind,file,title,href,source,receipt,observed,rights,assertion]=cols;
  if(!SOURCE[kind]||source!==SOURCE[kind]||!FILE.test(file)||!urlAllowed(href,kind)||
   !/^foreign:sha256:[0-9a-f]{64}$/.test(receipt)||!title||title.length>650||
   !/^\d{4}-\d\d-\d\dT/.test(observed)||!rights||!assertion)
   throw Error("Source claim violates the exact publication contract at row "+(index+2));
  const key=kind+"|"+file;if(seen.has(key))throw Error("Duplicate provider/file number: "+key);
  seen.add(key);return {kind,file,title,href,source,receipt,observed,rights,assertion};
 });
}
export function join(rows){
 const m=new Map();
 for(const x of rows){if(!m.has(x.file))m.set(x.file,{file:x.file,agenda:null,chapter:null});m.get(x.file)[x.kind]=x;}
 return [...m.values()].sort((a,b)=>a.file.localeCompare(b.file));
}
export const seconds=r=>{
 if(!r?.chapter)return null;
 const m=r.chapter.href.match(/\/play\/402001\/(\d+)$/);return m?Number(m[1]):null;
};
export const time=n=>n==null?"not indexed":
 [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,"0")).join(":");
export function stats(rows){
 const linked=join(rows);return {agenda:rows.filter(x=>x.kind==="agenda").length,
  chapters:rows.filter(x=>x.kind==="chapter").length,matched:linked.filter(x=>x.agenda&&x.chapter).length,
  withoutChapter:linked.filter(x=>x.agenda&&!x.chapter).length,withoutAgenda:linked.filter(x=>x.chapter&&!x.agenda).length};
}
export function diff(baseline,candidate){
 const prior=new Map(baseline.map(x=>[x.kind+"|"+x.file,x]));
 const next=new Map(candidate.map(x=>[x.kind+"|"+x.file,x]));
 const changes=[];
 for(const [key,row] of next){
  const prev=prior.get(key);
  if(!prev)changes.push({key,state:"new_candidate"});
  else if(["title","href","receipt","observed","rights","assertion"].some(field=>prev[field]!==row[field]))
   changes.push({key,state:"changed_candidate"});
 }
 for(const key of prior.keys())if(!next.has(key))changes.push({key,state:"absent_from_candidate_not_retracted"});
 return changes.sort((a,b)=>a.key.localeCompare(b.key));
}
export function clipWindow(group,from,to,all){
 if(!group||!group.chapter)throw Error("This file has no retained chapter to anchor an edit.");
 if(!Number.isInteger(from)||!Number.isInteger(to))throw Error("Use whole seconds on the official source clock.");
 const start=seconds(group);
 const next=all.filter(x=>x.chapter&&seconds(x)>start).map(seconds).sort((a,b)=>a-b)[0];
 if(from<start||to<=from||to-from>180)
  throw Error("Choose a clip inside the indexed chapter, at most 180 seconds.");
 if(next!==undefined&&to>next)
  throw Error("This proposed clip crosses the next indexed source chapter.");
 return {file:group.file,from,to,duration:to-from,chapterStart:start,nextChapter:next??null,
  agendaRef:group.agenda?.href??null,chapterRef:group.chapter.href,
  chapterReceipt:group.chapter.receipt,rights:group.chapter.rights};
}
const quoted=s=>'"'+plain(s).replaceAll('"',"'")+'"';
export function editDecision(group,window,review,requirements=[]){
 if(!window)throw Error("Choose and validate an exact clip range first.");
 return [
  "# Aurekai / native civic-media edit decision",
  "meeting 2026-09-23",
  "file "+group.file,
  "agenda "+quoted(group.agenda?.href??"unindexed"),
  "official_player "+quoted(window.chapterRef),
  "source_receipt "+window.chapterReceipt,
  "source_from_seconds "+window.from,
  "source_to_seconds "+window.to,
  "duration_seconds "+window.duration,
  "review_state "+quoted(review.state||"needs-review"),
  "review_note "+quoted(review.note||"unreviewed"),
  ...requirements.map(r=>"need "+quoted(r.kind)+" "+r.method+" "+quoted(r.note||"not established")),
  "media_body unavailable_in_static_site",
  "rights_state not_granted",
  "effect_authority none",
  "publication refused_until_source_owner_rights_and_review",
  "cannot_infer indexed_chapter_is_not_vote_transcript_or_media_license"
 ].join("\n")+"\n";
}
export function researchBrief(group,window,review,requirements=[]){
 if(!group)throw Error("Choose a native publication occurrence first.");
 return [
  "# City of Dallas · Council media review",
  "",
  "Meeting: September 23, 2026",
  "Exact agenda file: "+group.file,
  "Agenda summary: "+plain(group.agenda?.title??"No retained official agenda item"),
  "Indexed player: "+(group.chapter?.href??"No matching retained chapter"),
  "Observed source receipt: "+(group.chapter?.receipt??group.agenda?.receipt??"unavailable"),
  "Source-state qualifier: "+(group.chapter&&group.agenda?"exact file-number join":"unmatched occurrence; review source rather than infer absence"),"",
  "## Proposed media selection",
  window?time(window.from)+" — "+time(window.to)+" (source clock, "+window.duration+"s)":
    "No clip proposed; full source remains the official player.",
  "Source rights: "+(group.chapter?.rights??"No retained video license"),"",
  "## Reviewer questions and local decisions",
  "Review classification: "+plain(review.state||"needs-review"),
  "Reviewer note: "+plain(review.note||"none"),
  ...requirements.map(r=>"- "+plain(r.kind)+" via "+plain(r.method)+": "+plain(r.note||"not established")),
  "",
  "## Disposition",
  "No vote, transcript accuracy, media license, official action, remote recording transfer, WorkGraph execution or public publication is established by this source-linked draft."
 ].join("\n")+"\n";
}
