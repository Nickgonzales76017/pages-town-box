/* Town in a Box / Civic Council: source-linked, read-only workbench.
   Native owner: BonfyreProject / published BonfyreCMS publication_occurrence.
   User notes and plans are session-only until explicitly downloaded.
   No browser shadow database, no auto-publish, no fabricated actions. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FILE = /^\d{2}-\d{4}[A-Z]$/;
  const FIELDS = ['kind','file','title','href','source','receipt','observed','rights','assertion'];
  const SNAP = '2026-10-14 · BonfyreCMS · 2026-09-23 meeting';
  let baseline = [], current = [], sourceMode = 'published source snapshot';
  let chosen = '', filter = 'all', search = '', changes = new Set(), changedSummary = '';
  const reviews = new Map(), proofRequests = [];
  const readerText = (id, value) => { $(id).textContent = value; };
  const label = (name, cls) => {
    const el = document.createElement('span'); el.className = cls || 'pill'; el.textContent = name; return el;
  };
  const elem = (name, text, cls) => {
    const x = document.createElement(name); if (text !== undefined) x.textContent = String(text);
    if(cls)x.className=cls;return x;
  };
  const safeLink = (href, type) => {
    try {
      const u = new URL(href);
      if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return null;
      if(type === 'agenda') return u.hostname === 'cityofdallas.legistar.com' &&
        /^\/LegislationDetail\.aspx$/.test(u.pathname) ? u.href : null;
      if(type === 'chapter') return u.hostname === 'dallastx.new.swagit.com' &&
        /^\/play\/402001\/\d{1,8}$/.test(u.pathname) && !u.search ? u.href : null;
    } catch (_) {}
    return null;
  };
  const watchLink = (href, text) => {
    const a=elem('a',text,'action-link');a.href=href;a.target='_blank';a.rel='noopener noreferrer';
    a.setAttribute('aria-label',text+' (official provider; new tab)');return a;
  };
  function parseTSV(raw) {
    if(typeof raw !== 'string'||raw.length > 2500000)throw Error('The source file exceeds the bounded 2.5 MB review limit.');
    const lines=raw.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');
    const result=[], seen=new Set(); let header=false;
    for(let i=0;i<lines.length;i++) {
      const line=lines[i];
      if(!line||line.startsWith('#'))continue;
      if(!header) {
        if(line!==FIELDS.join('\t'))throw Error('File must carry the exact native publication header: '+FIELDS.join(' · '));
        header=true;continue;
      }
      if(result.length>=5000)throw Error('This review accepts up to 5,000 source rows.');
      const v=line.split('\t');if(v.length!==FIELDS.length)throw Error('Line '+(i+1)+' does not have 9 typed columns.');
      const entry=Object.fromEntries(FIELDS.map((key,j)=>[key,v[j].trim()]));
      if(!['agenda','chapter'].includes(entry.kind)||!FILE.test(entry.file))
        throw Error('Line '+(i+1)+' has an invalid provider kind/file number.');
      if(!safeLink(entry.href,entry.kind))throw Error('Line '+(i+1)+' is not an exact official-source link.');
      if(entry.title.length<3||entry.title.length>650||
         !/^foreign:sha256:[a-f0-9]{64}$/.test(entry.receipt))
        throw Error('Line '+(i+1)+' lacks bounded text or the retained source receipt.');
      if(!/^\d{4}-\d\d-\d\dT/.test(entry.observed))
        throw Error('Line '+(i+1)+' lacks its observation time.');
      if(entry.source!==(entry.kind==='agenda'?'dallas-council-20260923-legistar':'dallas-council-20260923-swagit'))
        throw Error('Line '+(i+1)+' has a source not admitted to this meeting.');
      const key=entry.kind+'|'+entry.file;
      if(seen.has(key))throw Error('Duplicate provider/file identity '+key+' on line '+(i+1)+'.');
      seen.add(key);
      result.push(entry);
    }
    if(!header||!result.length)throw Error('Source file contains no admissible agenda or chapter records.');
    return result;
  }
  const join = rows => {
    const map=new Map();
    for(const record of rows) {
      let r=map.get(record.file);
      if(!r) {r={file:record.file,agenda:null,chapter:null};map.set(record.file,r);}
      r[record.kind]=record;
    }
    return [...map.values()].sort((a,b)=>a.file.localeCompare(b.file));
  };
  const byFile = file => join(current).find(x=>x.file===file);
  const chapterSeconds = x => {
    if(!x||!x.chapter)return null;
    const m=x.chapter.href.match(/\/play\/402001\/(\d+)$/);return m?Number(m[1]):null;
  };
  function readableTime(value) {
    if(value===null)return 'Not indexed';
    const h=Math.floor(value/3600),m=Math.floor(value%3600/60),s=value%60;
    return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function stats() {
    const r=join(current), a=current.filter(x=>x.kind==='agenda').length,c=current.filter(x=>x.kind==='chapter').length,
      matched=r.filter(x=>x.agenda&&x.chapter).length, absent=r.filter(x=>x.agenda&&!x.chapter).length;
    readerText('statAgenda',a.toLocaleString());
    readerText('statVideo',c.toLocaleString());
    readerText('statMatched',String(matched));
    readerText('statGap',String(absent));
    readerText('sourceCaption',sourceMode+' · '+current.length+' retained occurrence rows');
    $('sourceCaption').setAttribute('data-mode',sourceMode);
  }
  function viewRows() {
    return join(current).filter(r => {
      if(filter==='matched'&&!(r.agenda&&r.chapter))return false;
      if(filter==='unindexed'&&!(r.agenda&&!r.chapter))return false;
      if(filter==='changed'&&!changes.has(r.file))return false;
      if(filter==='reviewed'&&!reviews.has(r.file))return false;
      const hay=(r.file+' '+(r.agenda?.title||'')+' '+(r.chapter?.title||'')).toLowerCase();
      return !search||hay.includes(search);
    });
  }
  function setChosen(file) {
    chosen=file;const params=new URL(window.location.href);
    if(file)params.searchParams.set('file',file);else params.searchParams.delete('file');
    window.history.replaceState(null,'',params.href);
    renderRows();renderDetail();renderBrief();
  }
  function renderRows() {
    const root=$('recordList');root.replaceChildren();
    const found=viewRows();readerText('resultsCount',String(found.length)+' items in this view');
    if(!found.length) {
      root.append(elem('p','No records match. Try a broader search or load another official observation snapshot.','empty'));
      return;
    }
    const frag=document.createDocumentFragment();
    for(const r of found) {
      const button=elem('button',undefined,'record'+(r.file===chosen?' selected':''));
      button.type='button';button.setAttribute('aria-pressed',String(r.file===chosen));
      button.addEventListener('click',()=>setChosen(r.file));
      const meta=elem('div',undefined,'record-meta');
      meta.append(elem('span',r.file,'file-id'),
        label(r.chapter?'Chapter indexed':'Agenda only',r.chapter?'pill green':'pill muted'));
      if(changes.has(r.file))meta.append(label('Updated observation','pill amber'));
      if(reviews.has(r.file))meta.append(label('Review drafted','pill violet'));
      button.append(meta,elem('p',r.agenda?.title||r.chapter?.title||'Official source record','record-title'));
      const foot=elem('div',undefined,'record-foot');
      foot.append(elem('span',r.chapter?readableTime(chapterSeconds(r)):'No stored chapter','mono'),
        elem('span',r.agenda?'Official agenda linked':'Video only · needs review','minor'));
      button.append(foot);frag.append(button);
    }
    root.append(frag);
  }
  function renderTimeline() {
    const root=$('timeline');root.replaceChildren();
    const rows=join(current).filter(r=>r.chapter).sort((a,b)=>chapterSeconds(a)-chapterSeconds(b));
    if(!rows.length) {root.append(elem('p','No indexed chapters were retained.','empty'));return;}
    const times=rows.map(chapterSeconds),lo=Math.min(...times),hi=Math.max(...times);
    const track=elem('div',undefined,'time-track');
    for(const row of rows) {
      const time=chapterSeconds(row),button=elem('button',undefined,'time-marker');
      button.type='button';button.title=row.file+' · '+readableTime(time);
      button.style.left=((time-lo)/(hi-lo||1)*96+2)+'%';
      button.setAttribute('aria-label',row.file+', indexed at '+readableTime(time));
      button.addEventListener('click',()=>{filter='all';$('filterButtons').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));setChosen(row.file);});
      track.append(button);
    }
    root.append(track,elem('div',readableTime(lo)+' → '+readableTime(hi)+' · '+rows.length+' indexed starts','timeline-caption'));
  }
  function renderDetail() {
    const root=$('details');root.replaceChildren();
    const row=byFile(chosen);
    if(!row){root.append(elem('p','Choose an agenda item or timeline marker. The original provider references and their observation lineage will appear here.','empty'));return;}
    root.append(elem('div',row.file,'eyebrow'),elem('h2',row.agenda?.title||row.chapter?.title||row.file));
    const state=elem('div',undefined,'detail-state');
    state.append(label(row.chapter?'Exact file-number chapter join':'No chapter in retained snapshot',row.chapter?'pill green':'pill amber'));
    root.append(state);
    const explanation=elem('p',row.chapter?
      'This agenda item and stored Swagit chapter share one exact official file number. The timestamp is an indexed video start, not proof of a decision or accurate transcript.':
      'This agenda file has no video chapter in the retained CMS snapshot. This does not establish that the topic was not discussed, filmed or acted upon.','explanation');
    root.append(explanation);
    for(const [rec,name] of [[row.agenda,'Agenda source'],[row.chapter,'Indexed recording chapter']]) {
      if(!rec)continue;
      const section=elem('section',undefined,'lineage-card');
      section.append(elem('div',name,'caption-label'));
      section.append(watchLink(rec.href,name==='Agenda source'?'Open official Legistar item':'Watch at '+readableTime(chapterSeconds(row))));
      for(const [k,v] of [['Source owner',rec.source],['Observed',rec.observed],['Observation receipt',rec.receipt],['Retention / rights',rec.rights],['Assertion state',rec.assertion]]) {
        const dl=elem('div',undefined,'lineage-row');dl.append(elem('span',k),elem('code',v));section.append(dl);
      }
      root.append(section);
    }
    const r=reviews.get(row.file);$('reviewStatus').value=r?.status||'needs-review';
    $('reviewNote').value=r?.note||'';
    renderProofRequests();
  }
  function renderProofRequests() {
    const root=$('proofList');root.replaceChildren();
    const items=proofRequests.filter(x=>x.file===chosen);
    if(!items.length)root.append(elem('p','No verification request drafted for this item.','minor'));
    for(const [i,r] of items.entries()) {
      const wrap=elem('div',undefined,'proof-chip');
      wrap.append(elem('span',r.kind+' · '+r.method+' · pending, no quote'));
      const rem=elem('button','Remove');rem.type='button';rem.className='quiet';
      rem.addEventListener('click',()=>{
        const ix=proofRequests.indexOf(r);if(ix>=0)proofRequests.splice(ix,1);
        renderProofRequests();renderBrief();
      });
      wrap.append(rem);root.append(wrap);
    }
  }
  function renderBrief() {
    const row=byFile(chosen),target=$('briefPreview');
    if(!row){target.textContent='Select a source record to compose a review brief.';return;}
    const recipient=$('briefAudience').value||'Research review';
    const r=reviews.get(chosen);
    const includes={citations:$('includeCitations').checked,unresolved:$('includeGaps').checked,requests:$('includeProof').checked};
    const lines=[
      '# '+recipient+' — Dallas Council meeting review',
      '',
      'Meeting: September 23, 2026',
      'Agenda file: '+row.file,
      'Observation source: '+(sourceMode==='published source snapshot'?'BonfyreCMS published occurrence snapshot':'locally imported candidate source; not owner verified'),
      '',
      '## Source-linked subject',
      row.agenda?.title||row.chapter?.title||'No agenda title admitted',
      '',
      'Status: '+(row.chapter?'Exact file-number match between two published occurrence records.':'Agenda only in current retained occurrence snapshot.'),
      'Video index: '+(row.chapter?readableTime(chapterSeconds(row)):'No retained chapter match'),
      'Reviewer state: '+(r?.status||'Not reviewed'),
      r?.note?'Reviewer note: '+r.note:'',
      ''
    ];
    if(includes.citations)lines.push(
      '## Original sources',
      row.agenda?'Agenda: '+row.agenda.href:'Agenda: not retained',
      row.chapter?'Indexed chapter: '+row.chapter.href:'Indexed chapter: not retained',
      row.agenda?'Agenda receipt: '+row.agenda.receipt:'',
      row.chapter?'Video receipt: '+row.chapter.receipt:'',
      '');
    if(includes.unresolved)lines.push('## What cannot be concluded',
      '- A shared file number does not establish a vote, decision, transcript, or licensing right.',
      '- A missing index is not evidence that no video or council action exists.',
      '- An imported replacement file is a review candidate until reconciled by the owning native workflow.',
      '');
    if(includes.requests){
      lines.push('## Verification requests proposed');
      const active=proofRequests.filter(x=>x.file===chosen);
      if(!active.length)lines.push('- None drafted.');
      for(const x of active)lines.push('- '+x.kind+' by '+x.method+
        ' — no verified quote, authorization or dispatched work.');
      lines.push('');
    }
    lines.push('## Release status','Research draft only. This brief is not an official Dallas record, authorized field dispatch, finding of fact or public institutional action.');
    target.textContent=lines.filter(x=>x!=='').join('\n');
  }
  function exportText(text,filename,mime){
    const blob=new Blob([text],{type:mime||'text/plain;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  function tsvSafe(s) {return String(s??'').replace(/[\t\n\r\u0000-\u001f]/g,' ').trim().slice(0,900);}
  function exportReviews(){
    if(!reviews.size&&!proofRequests.length){readerText('message','No reviewer decisions or verification needs to export.');return;}
    const rows=['# Proposed human review only. Not submitted to CMS, WorkGraph, Finance, or provider.',
      'file\treview_status\treviewer_note\tproof_kind\tpreferred_method\tagenda_source_ref\tvideo_source_ref'];
    for(const [file,decision] of reviews){
      const row=byFile(file),requests=proofRequests.filter(x=>x.file===file);
      if(!requests.length)requests.push({kind:'-',method:'-'});
      for(const req of requests)rows.push([file,decision.status,decision.note,req.kind,req.method,row?.agenda?.source||'-',row?.chapter?.source||'-'].map(tsvSafe).join('\t'));
    }
    for(const req of proofRequests.filter(x=>!reviews.has(x.file))){
      const row=byFile(req.file);
      rows.push([req.file,'no-review','',req.kind,req.method,row?.agenda?.source||'-',row?.chapter?.source||'-'].map(tsvSafe).join('\t'));
    }
    exportText(rows.join('\n')+'\n','civic-review-proposals-20260923.tsv','text/tab-separated-values;charset=utf-8');
    readerText('message','Downloaded proposed review decisions. No public, CMS or provider state was changed.');
  }
  function compare(imported){
    const a=new Map(baseline.map(r=>[r.kind+'|'+r.file,r]));
    const b=new Map(imported.map(r=>[r.kind+'|'+r.file,r]));
    const difference=[],affected=new Set();
    for(const [key,row] of b){
      const prior=a.get(key);
      if(!prior){difference.push({key,kind:'new observed candidate'});affected.add(row.file);}
      else if(['href','title','receipt','observed','rights','assertion'].some(k=>row[k]!==prior[k])) {
        difference.push({key,kind:'changed source assertion'});affected.add(row.file);
      }
    }
    for(const [key,row] of a)if(!b.has(key)){
      difference.push({key,kind:'absent from imported file'});affected.add(row.file);
    }
    return {difference,affected};
  }
  function renderChanges(items){
    const el=$('changeList');el.replaceChildren();
    if(!items.length){el.append(elem('p','No source differences against the retained baseline.','minor'));return;}
    for(const x of items.slice(0,80)){
      const row=elem('div',undefined,'diff-line');
      row.append(elem('b',x.key),label(x.kind,'pill amber'));el.append(row);
    }
    if(items.length>80)el.append(elem('p',String(items.length-80)+' further differences omitted from on-screen preview.','minor'));
  }
  function renderAll(){
    stats();renderTimeline();renderRows();renderDetail();renderBrief();
  }
  function configureFilters() {
    $('filterButtons').addEventListener('click',e=>{
      const b=e.target.closest('button[data-filter]');if(!b)return;
      filter=b.dataset.filter;
      for(const child of $('filterButtons').querySelectorAll('button'))child.classList.toggle('active',child===b);
      renderRows();
    });
    $('recordSearch').addEventListener('input',e=>{search=e.target.value.toLowerCase().trim().slice(0,160);renderRows();});
  }
  async function loadSnapshot() {
    try {
      readerText('message','Reading published native occurrence snapshot…');
      const response=await fetch('./occurrences.tsv',{cache:'no-store'});
      if(!response.ok)throw Error('Snapshot unavailable (HTTP '+response.status+')');
      const raw=await response.text();
      baseline=parseTSV(raw);current=baseline.slice();
      if(current.length!==91||current.filter(r=>r.kind==='agenda').length!==70||
         current.filter(r=>r.kind==='chapter').length!==21)
        throw Error('Native snapshot count drifted; refuse silent count substitution.');
      sourceMode='published source snapshot';changes=new Set();renderChanges([]);
      const query=new URL(window.location.href).searchParams.get('file');
      chosen=query&&FILE.test(query)?query:(join(current).find(r=>r.chapter)?.file||join(current)[0]?.file);
      renderAll();readerText('message','Native readback loaded: 70 agenda + 21 chapter rows. The unresolved provider/CMS gap remains visible.');
    }catch(error) {
      $('recordList').replaceChildren(elem('p',error.message,'empty'));
      readerText('message','Loading refused: '+error.message);
      readerText('sourceCaption','Source unavailable; no data fabricated');
    }
  }
  async function importCandidate(file) {
    if(!file)return;
    try{
      if(file.size>2500000)throw Error('Choose a source file smaller than 2.5 MB.');
      const parsed=parseTSV(await file.text());
      const result=compare(parsed);
      current=parsed;changes=result.affected;sourceMode='local candidate import (unverified)';
      changedSummary=result.difference.length+' changed or missing source coordinates in imported review candidate';
      renderChanges(result.difference);
      $('candidateResult').textContent=changedSummary;
      if(!byFile(chosen))chosen=join(current)[0]?.file||'';
      renderAll();
      readerText('message','Candidate compared; '+changedSummary+'. No changes entered the native CMS.');
    }catch(e){
      readerText('message','Import refused: '+e.message);$('candidateResult').textContent='Candidate was not admitted.';
    }
  }
  function init() {
    configureFilters();
    $('candidateFile').addEventListener('change',e=>importCandidate(e.target.files?.[0]));
    $('resetCandidate').addEventListener('click',()=>{
      current=baseline.slice();changes=new Set();sourceMode='published source snapshot';
      $('candidateFile').value='';$('candidateResult').textContent='No candidate imported.';
      renderChanges([]);renderAll();readerText('message','Reverted to the unchanged published CMS snapshot.');
    });
    $('saveReview').addEventListener('click',()=>{
      if(!byFile(chosen))return;
      const note=$('reviewNote').value.trim();
      if(note.length>900){readerText('message','Review note must remain under 900 characters.');return;}
      reviews.set(chosen,{status:$('reviewStatus').value,note});
      renderRows();renderBrief();
      readerText('message','Review drafted in this browser session only; export to retain or hand it off.');
    });
    $('addProof').addEventListener('click',()=>{
      if(!byFile(chosen))return;
      if(proofRequests.length>=100){readerText('message','Verification proposal limit reached.');return;}
      const kind=$('proofKind').value,method=$('proofMethod').value;
      if(proofRequests.some(x=>x.file===chosen&&x.kind===kind&&x.method===method)){
        readerText('message','This proof need and method are already proposed.');return;}
      proofRequests.push({file:chosen,kind,method});renderProofRequests();renderBrief();
      readerText('message','Verification requirement proposed, not dispatched or quoted.');
    });
    for(const id of ['briefAudience','includeCitations','includeGaps','includeProof']){
      $(id).addEventListener('change',renderBrief);
    }
    $('downloadBrief').addEventListener('click',()=>{
      if(!chosen)return;
      renderBrief();
      exportText($('briefPreview').textContent+'\n','civic-brief-'+chosen+'.md','text/markdown;charset=utf-8');
    });
    $('exportReviews').addEventListener('click',exportReviews);
    $('printBrief').addEventListener('click',()=>window.print());
    $('openSelectedVideo').addEventListener('click',()=>{
      const r=byFile(chosen);
      if(!r?.chapter){readerText('message','No official chapter is retained for this file number.');return;}
      window.open(r.chapter.href,'_blank','noopener,noreferrer');
    });
    loadSnapshot();
  }
  init();
})();
