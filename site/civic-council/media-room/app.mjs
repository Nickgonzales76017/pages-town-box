import {parseSnapshot,join,seconds,time,stats,diff,clipWindow,editDecision,researchBrief,esc,urlAllowed} from "./core.mjs";
const $=id=>document.getElementById(id);
let baseline=[],rows=[],groups=[],selected="",sourceMode="Retained BonfyreCMS public occurrence snapshot";
let reviews=new Map(),cuts=new Map(),proofs=new Map(),changes=[],store=null,revision=0,objectUrl=null;
const notify=(text,error=false)=>{const m=$("message");m.textContent=text;m.className="message"+(error?" error":"")};
const group=()=>groups.find(x=>x.file===selected)??null;
const localReview=()=>reviews.get(selected)??{state:"needs-review",note:""};
const localProof=()=>proofs.get(selected)??[];
const saveable=()=>({reviews:[...reviews],cuts:[...cuts],proofs:[...proofs]});
function hydrate(s){if(s?.reviews)reviews=new Map(s.reviews);if(s?.cuts)cuts=new Map(s.cuts);if(s?.proofs)proofs=new Map(s.proofs);}
async function openLocal(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open("aurekai-civic-media-review",1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("workspace"))req.result.createObjectStore("workspace")};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
async function readLocal(){
 return new Promise((yes,no)=>{
  const req=store.transaction("workspace","readonly").objectStore("workspace").get("dallas-20260923");
  req.onsuccess=()=>yes(req.result??null);req.onerror=()=>no(req.error);
 });
}
async function writeLocal(){
 return new Promise((yes,no)=>{
  const tx=store.transaction("workspace","readwrite"),table=tx.objectStore("workspace");
  const r=table.get("dallas-20260923");let next;
  r.onsuccess=()=>{if((r.result?.revision??0)!==revision){tx.abort();return;}
    next=revision+1;table.put({revision:next,value:structuredClone(saveable())},"dallas-20260923")};
  tx.oncomplete=()=>yes(next);tx.onerror=()=>no(tx.error);
  tx.onabort=()=>no(Error("Another tab committed a newer review. Reload before overwriting."));
 });
}
function download(name,content,mime="text/plain;charset=utf-8"){
 const url=URL.createObjectURL(new Blob([content],{type:mime})),a=document.createElement("a");
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function changed(){ $("saveState").textContent="Unsaved local review"; renderProgress();renderPaper();}
function pick(id){
 if(!groups.some(x=>x.file===id))return;
 selected=id;const u=new URL(location.href);u.searchParams.set("file",id);history.replaceState(null,"",u);
 render();
}
function renderProgress(){
 const selectedGroup=group(),review=localReview(),window=cuts.get(selected);
 const steps=[
  ["Source",!!selectedGroup?.agenda],
  ["Exact join",!!selectedGroup?.chapter&&!!selectedGroup?.agenda],
  ["Review draft",review.state!=="needs-review"],
  ["Edit window",!!window],
  ["Typed packet",!!selectedGroup]
 ];
 $("progress").innerHTML=steps.map(([text,done],i)=>
  '<span class="step '+(done?"complete":"")+'"><b>'+String(i+1).padStart(2,"0")+'</b><span>'+text+'</span><em>'+(done?"Prepared":"Open")+'</em></span>').join("");
}
function filterGroups(){
 const value=$("sourceSearch").value.toLowerCase(),mode=$("statusFilter").value;
 return groups.filter(x=>(mode==="all"||mode==="matched"&&x.agenda&&x.chapter||
  mode==="agenda-only"&&x.agenda&&!x.chapter||
  mode==="chapter-only"&&x.chapter&&!x.agenda||
  mode==="changed"&&changes.some(d=>d.key.endsWith("|"+x.file))||
  mode==="reviewed"&&reviews.has(x.file))&&
  (x.file+" "+(x.agenda?.title||"")+" "+(x.chapter?.title||"")).toLowerCase().includes(value));
}
function renderList(){
 const result=filterGroups();$("resultCount").textContent=result.length+" exact file identities in this view";
 $("fileList").innerHTML=result.map(x=>
 '<button type="button" class="fileRow '+(x.file===selected?"selected":"")+'" data-file="'+esc(x.file)+'">'+
 '<span class="fileCode">'+x.file+'</span><span class="fileLabel">'+esc((x.agenda?.title||x.chapter?.title||"No official text").slice(0,125))+
 '</span><span class="fileState '+(x.chapter?"joined":"")+'">'+
 (x.agenda&&x.chapter?"Video indexed":x.agenda?"Agenda only":"Chapter only")+'</span></button>'
 ).join("")||'<p class="empty">No source file matches this view.</p>';
 $("fileList").querySelectorAll("[data-file]").forEach(btn=>btn.addEventListener("click",()=>pick(btn.dataset.file)));
}
function renderTimeline(){
 const withChapter=groups.filter(x=>x.chapter).sort((a,b)=>seconds(a)-seconds(b));
 const min=withChapter.length?seconds(withChapter[0]):0,max=withChapter.length?seconds(withChapter.at(-1)):1;
 $("filmstrip").innerHTML=withChapter.map((x,i)=>{
 const pct=Math.max(0,Math.min(96,(seconds(x)-min)/(max-min||1)*96));
 return '<button type="button" class="frame '+(x.file===selected?"selected":"")+'" data-jump="'+x.file+
 '" style="left:'+pct+'%" title="'+x.file+' at '+time(seconds(x))+'" aria-label="'+x.file+" indexed "+time(seconds(x))+'"><i></i></button>';
 }).join("")+'<div class="ruler"><span>'+time(min)+'</span><span>'+time(max)+'</span></div>';
 $("filmstrip").querySelectorAll("[data-jump]").forEach(btn=>btn.addEventListener("click",()=>pick(btn.dataset.jump)));
}
function nextTime(g){
 const begin=seconds(g);return groups.filter(x=>x.chapter&&seconds(x)>begin).map(seconds).sort((a,b)=>a-b)[0]??null;
}
function renderSource(){
 const g=group();if(!g)return;
 $("fileCode").textContent=g.file;
 $("fileTitle").textContent=(g.agenda?.title||g.chapter?.title||"Unmatched official occurrence").slice(0,280);
 $("joined").textContent=g.agenda&&g.chapter?"Exact agenda/video file number":"Unmatched in the retained source cut";
 $("sourceState").textContent=sourceMode;
 $("agendaLink").href=g.agenda?.href||"#";$("agendaLink").hidden=!g.agenda;
 $("playerLink").href=g.chapter?.href||"#";$("playerLink").hidden=!g.chapter;
 $("agendaReceipt").textContent=g.agenda?.receipt||"No agenda observation";
 $("videoReceipt").textContent=g.chapter?.receipt||"No indexed chapter observation";
 $("rights").textContent=g.chapter?.rights||"No retained media rights statement";
 $("indexTime").textContent=g.chapter?time(seconds(g)):"No recorded chapter";
}
function renderClip(){
 const g=group();if(!g)return;
 const win=cuts.get(selected),start=seconds(g),next=nextTime(g);
 $("chapterClock").textContent=g.chapter?time(start):"No chapter indexed";
 $("clipStart").disabled=!g.chapter;$("clipEnd").disabled=!g.chapter;
 $("clipStart").value=win?.from??(start??"");
 $("clipEnd").value=win?.to??(g.chapter?start+Math.min(30,next?Math.max(1,next-start):30):"");
 $("clipEnd").max=next??"";$("clipStart").min=start??"";
 $("clipBoundary").textContent=!g.chapter?"No exact video index. A media clip cannot be inferred.":
  "Start "+time(start)+(next?" · next official index "+time(next):" · no next index retained")+
  ". Proposed edits must stay within this interval and at most 180 seconds.";
 $("editPreview").innerHTML=win?
   '<strong>'+time(win.from)+' → '+time(win.to)+'</strong><p>'+
   win.duration+' seconds proposed; official indexed link only. No video copied or license granted.</p>':
   '<strong>No admitted cut decision</strong><p>Choose source-clock in/out points; validate against the next retained chapter.</p>';
 $("nativeCmd").textContent=win?
   'bonfyre-clips cut --source /path/to/PERMITTED-full-recording.mp4 --start '+
   win.from+' --end '+win.to+' --out /path/to/new-private-cut --title "Dallas '+selected+
   '" --credit "Source-owner permission required"':"No native clip operation planned.";
}
function renderReview(){
 const r=localReview();$("reviewStatus").value=r.state;$("reviewNote").value=r.note;
 $("proofList").innerHTML=localProof().map((x,i)=>
 '<div class="proofRow"><span>'+esc(x.kind)+' · '+esc(x.method)+
 ' · unverified</span><button type="button" data-removeproof="'+i+'">Remove</button></div>'
 ).join("")||'<p class="empty">No verification requirements drafted.</p>';
 $("proofList").querySelectorAll("[data-removeproof]").forEach(b=>b.addEventListener("click",()=>{
  const next=localProof();next.splice(Number(b.dataset.removeproof),1);proofs.set(selected,next);changed();renderReview();
 }));
}
function renderPaper(){
 const g=group();if(!g)return;
 const r=localReview(),w=cuts.get(selected),requires=localProof();
 $("paperTitle").textContent=g.file+" / source-linked research";
 $("paperAgenda").textContent=g.agenda?.title||"Unmatched agenda";
 $("paperVideo").textContent=g.chapter?"Exact chapter indexed at "+time(seconds(g)):"No retained chapter match";
 $("paperEdit").textContent=w?time(w.from)+" — "+time(w.to)+" · proposed only":"No cut proposed";
 $("paperProof").textContent=requires.length?requires.map(x=>x.kind+" via "+x.method).join("; "):"No independent checks requested";
 $("paperReviewer").textContent=r.state+" · "+(r.note||"no local note");
 $("paperRelease").textContent="Source observation ≠ vote, transcript, media license, publication or authorized task.";
 $("briefStudio").href=handoffUrl(g,r,requires);
}
function handoffUrl(g,r,needs){
 const url=new URL("https://nickgonzales76017.github.io/pages-procurement-memory/brief-studio/");
 url.searchParams.set("handoff","civic");url.searchParams.set("subject",g.file);
 url.searchParams.set("title",(g.agenda?.title||g.chapter?.title||g.file).slice(0,160));
 url.searchParams.set("source",(g.agenda||g.chapter)?.href||"");
 url.searchParams.set("assertion",("Exact source "+g.file+". Indexed chapter: "+
  (g.chapter?.href||"not retained")+". Source receipt "+
  (g.chapter?.receipt||g.agenda?.receipt||"not retained")).slice(0,1000));
 if(needs.length)url.searchParams.set("proof",needs.slice(0,4).map(x=>x.kind+":"+x.method).join(","));
 if(r.note)url.searchParams.set("note",r.note.slice(0,800));return url.href;
}
function render(){
 groups=join(rows);const statsNow=stats(rows);
 $("statText").textContent=statsNow.agenda+" agenda · "+statsNow.chapters+
 " indexed video · "+statsNow.matched+" exact joins · "+statsNow.withoutChapter+" agenda-only";
 renderList();renderTimeline();renderSource();renderClip();renderReview();renderPaper();renderProgress();
}
$("sourceSearch").addEventListener("input",renderList);$("statusFilter").addEventListener("change",renderList);
$("setWindow").addEventListener("click",()=>{
 const g=group();if(!g)return;
 try{
  const f=Number($("clipStart").value),t=Number($("clipEnd").value);
  const w=clipWindow(g,f,t,groups);cuts.set(selected,w);changed();renderClip();
  notify("Prepared a source-clock edit decision; not a rendered clip or rights grant.");
 }catch(e){notify(e.message,true)}
});
$("seekLocal").addEventListener("click",()=>{
 const g=group(),player=$("localPlayer");if(!g?.chapter||!player.src)return notify("Load a permitted full-meeting video and choose an indexed chapter first.",true);
 if(!Number.isFinite(player.duration)||player.duration<seconds(g))return notify("Local media does not reach this indexed source clock; check the recording and offset.",true);
 player.currentTime=seconds(g);void player.play().catch(()=>{});
});
$("localVideo").addEventListener("change",e=>{
 const f=e.target.files[0];if(!f)return;
 if(objectUrl)URL.revokeObjectURL(objectUrl);
 objectUrl=URL.createObjectURL(f);$("localPlayer").src=objectUrl;$("localVideoLabel").textContent=
 "Playing an operator-supplied local recording: "+f.name+". No upload occurred.";
});
$("saveReview").addEventListener("click",()=>{
 const g=group();if(!g)return;
 reviews.set(selected,{state:$("reviewStatus").value,note:$("reviewNote").value.trim().slice(0,900)});
 changed();renderReview();notify("Review retained locally. No CMS or WorkGraph state changed.");
});
$("addProof").addEventListener("click",()=>{
 const g=group();if(!g)return;
 const list=localProof(),kind=$("proofKind").value,method=$("proofMethod").value;
 if(list.length>=12)return notify("At most twelve proposed checks per file.",true);
 if(kind==="rights"&&!["owner","licensed"].includes(method))return notify("Recording rights require a source-owner or qualified specialist method.",true);
 list.push({kind,method,note:"pending source"});proofs.set(selected,list);changed();renderReview();renderPaper();
});
$("candidateImport").addEventListener("change",async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const next=parseSnapshot(await f.text());changes=diff(baseline,next);rows=next;sourceMode="USER-IMPORTED CANDIDATE — NOT NATIVE-ADMITTED";
  if(!join(rows).some(x=>x.file===selected))selected=join(rows)[0].file;
  render();notify("Compared "+changes.length+" changed/absent candidate rows. None were promoted to the owner source.");
 }catch(error){notify(error.message,true)}finally{e.target.value="";}
});
$("resetSource").addEventListener("click",()=>{rows=baseline;changes=[];sourceMode="Retained BonfyreCMS public occurrence snapshot";render();notify("Restored the original retained source cut.");});
$("showDiff").addEventListener("click",()=>{
 $("differences").innerHTML=changes.map(x=>'<p><b>'+esc(x.key)+'</b> · '+esc(x.state)+'</p>').join("")||"No candidate differences detected.";
});
$("exportBrief").addEventListener("click",()=>{
 try{download("dallas-"+selected+"-civic-review.md",researchBrief(group(),cuts.get(selected),localReview(),localProof()),"text/markdown;charset=utf-8");
  notify("Downloaded a sourced research brief; no public or council records changed.");}
 catch(e){notify(e.message,true);}
});
$("exportDecision").addEventListener("click",()=>{
 try{download("dallas-"+selected+"-clip-edit.yaff",editDecision(group(),cuts.get(selected),localReview(),localProof()));
 notify("Downloaded a typed native edit proposal. No media was fetched or published.");}
 catch(e){notify(e.message,true)}
});
$("saveWorkspace").addEventListener("click",async()=>{
 if(!store)return notify("Local persistence unavailable; export a human brief.",true);
 try{revision=await writeLocal();$("saveState").textContent="Saved on this browser · revision "+revision;
 notify("Local reviewer revisions saved. CMS and providers have not been contacted.");}catch(e){notify(e.message,true)}
});
window.addEventListener("pagehide",()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);});
(async()=>{
 try{
  const response=await fetch(new URL("../occurrences.tsv",import.meta.url),{cache:"no-cache"});
  if(!response.ok)throw Error("retained native-public source cut unavailable");
  baseline=parseSnapshot(await response.text());rows=baseline;groups=join(rows);
  selected=new URL(location.href).searchParams.get("file")||groups.find(x=>x.chapter&&x.agenda)?.file||groups[0].file;
  if(!groups.some(x=>x.file===selected))selected=groups[0].file;
  try{store=await openLocal();const record=await readLocal();
   if(record){revision=record.revision;hydrate(record.value);notify("Restored your local, source-linked review.");}}
  catch(e){notify("Local review storage unavailable: "+e.message,true)}
  render();
 }catch(e){notify("Cannot open native source material: "+e.message,true);}
})();
