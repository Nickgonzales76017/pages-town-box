import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseSnapshot,join,seconds,time,stats,diff,clipWindow,editDecision,researchBrief,urlAllowed} from "../../site/civic-council/media-room/core.mjs";

const retained=readFileSync(new URL("../../site/civic-council/occurrences.tsv",import.meta.url),"utf8");
const rows=parseSnapshot(retained);
const full=join(rows);
test("Retained Dallas CMS source cut is exact 70 agenda + 21 indexed video records",()=>{
 const summary=stats(rows);
 assert.equal(summary.agenda,70);
 assert.equal(summary.chapters,21);
 assert.ok(summary.matched>0);
 assert.equal(rows.length,91);
 assert.equal(new Set(rows.map(x=>x.kind+"|"+x.file)).size,91);
 assert.ok(rows.every(x=>urlAllowed(x.href,x.kind)));
 assert.ok(rows.every(x=>x.receipt.startsWith("foreign:sha256:")));
});

test("Source clock is an actual indexed player coordinate; a gap is not a missing vote",()=>{
 const matched=full.filter(x=>x.agenda&&x.chapter).sort((a,b)=>seconds(a)-seconds(b));
 assert.ok(matched.length>1);
 assert.equal(typeof seconds(matched[0]),"number");
 const group=matched[0],begin=seconds(group),next=full.filter(x=>x.chapter&&seconds(x)>begin).map(seconds).sort((a,b)=>a-b)[0];
 assert.ok(next>begin);
 const end=Math.min(begin+Math.max(1,Math.min(30,next-begin)),next);
 const window=clipWindow(group,begin,end,full);
 assert.equal(window.from,begin);assert.equal(window.duration,end-begin);
 assert.equal(window.chapterReceipt,group.chapter.receipt);
 assert.match(time(window.from),/^\d{2}:\d{2}:\d{2}$/);
 assert.throws(()=>clipWindow(group,begin-1,end,full),/inside the indexed chapter/);
 assert.throws(()=>clipWindow(group,begin,begin+181,full),/180 seconds|crosses the next/);
 assert.throws(()=>clipWindow(full.find(x=>x.agenda&&!x.chapter),1,2,full),/no retained chapter/);
});

test("Research and cut proposals preserve exact source, rights boundary and lack of owner effect",()=>{
 const group=full.find(x=>x.agenda&&x.chapter);
 const from=seconds(group),others=full.filter(x=>x.chapter&&seconds(x)>from).map(seconds).sort((a,b)=>a-b);
 const to=Math.min(from+8,others[0]??from+8);
 const w=clipWindow(group,from,to,full);
 const note={state:"research",note:"Does the exact agenda action correspond to the video index?"};
 const requirements=[{kind:"rights",method:"owner",note:"pending source-owner confirmation"}];
 const plan=editDecision(group,w,note,requirements);
 assert.match(plan,/program|edit decision|native civic-media/);
 assert.match(plan,/rights_state not_granted/);
 assert.match(plan,/effect_authority none/);
 assert.match(plan,/source_receipt foreign:sha256:/);
 const brief=researchBrief(group,w,note,requirements);
 assert.match(brief,/No vote, transcript accuracy, media license/);
 assert.match(brief,new RegExp(group.file));
 assert.match(brief,/owner/);
});

test("A new source cut produces reviewable deltas without inferring authoritative retirement",()=>{
 const amended=rows.map(x=>({...x}));
 amended[0].title+=" (candidate revision)";
 let result=diff(rows,amended);
 assert.deepEqual(result.map(x=>x.state),["changed_candidate"]);
 result=diff(rows,amended.slice(1));
 assert.ok(result.some(x=>x.state==="absent_from_candidate_not_retracted"));
 const extra={...amended[0],file:"26-9999A"};
 assert.ok(diff(rows,[...rows,extra]).some(x=>x.state==="new_candidate"));
});

test("Invalid provider identity and unauthorized URLs refuse the entire source cut",()=>{
 const badUrl=retained.replace("https://cityofdallas.legistar.com/LegislationDetail.aspx","javascript:alert(1)");
 assert.throws(()=>parseSnapshot(badUrl),/exact publication contract/);
 const badType=retained.replace("dallas-council-20260923-legistar","unknown-owner");
 assert.throws(()=>parseSnapshot(badType),/exact publication contract/);
 assert.throws(()=>parseSnapshot(retained+rows[0].kind+"\t"+rows[0].file+"\t"+rows[0].title+"\t"+rows[0].href+"\t"+rows[0].source+"\t"+rows[0].receipt+"\t"+rows[0].observed+"\t"+rows[0].rights+"\t"+rows[0].assertion+"\n"),/Duplicate/);
 assert.equal(urlAllowed("https://untrusted.example/LegislationDetail.aspx","agenda"),false);
 assert.equal(urlAllowed("https://dallastx.new.swagit.com/play/402001/123#extra","chapter"),false);
});
