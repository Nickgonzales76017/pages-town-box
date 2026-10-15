/* Bonfÿre Council Reading Room — document-first projection, no shadow store.
   Source: native BonfyreCMS publication_occurrence export (bounded TSV).
   Foreign media is linked, never downloaded, mirrored or declared playable.
   Review positions live in memory only; explicitly exported handoff is TSV. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PUBLISHER = 'https://dallastx.new.swagit.com/videos/402001';
  const SOURCE_KEYS = ['kind','file','title','href','source','receipt','observed','rights','assertion'];
  const FILE = /^\d{2}-\d{4}[A-Z]$/;
  const LENSES = [
    {id:'land',name:'Who gets to build?',question:'Land use, housing and the shape of the city',description:'Read zoning proposals, planned-development questions and housing-related agenda language.',match:/housing|residen|zoning|planned develop|single.family|dwelling|affordable|apartment|mixed.use|land.use|district|subdistrict|rezon/i},
    {id:'water',name:'What moves beneath us?',question:'Water, remediation and city infrastructure',description:'Follow the sources that mention water systems, remediation, drainage and environmental conditions.',match:/groundwater|water|drainage|flood|environment|municipal setting|wastewater|stormwater|remediation|asbestos|lead/i},
    {id:'streets',name:'How does the city change?',question:'Streets, public space and transport',description:'Look at street engineering, names, pedestrian space and the public right-of-way.',match:/street|road|sidewalk|traffic|transport|bicycle|park|corridor|pedestrian|right.of.way|highway/i},
    {id:'money',name:'Who does the work?',question:'Contracts, budgets and municipal services',description:'Read contracts and proposed spending without assuming a motion was adopted.',match:/contract|agreement|funding|grant|purchase|budget|procurement|construction|professional services|authorize/i}
  ];
  let original = [], records = [], fileMap = new Map(), story = [], lens = '', position = 0, sourceTab = 'agenda';
  let localCandidate = false, comparison = [];
  const decisions = new Map(), folio = [];
  const setStatus = (s,important=false) => {const el=$('statusMessage');el.replaceChildren(); if(important)el.appendChild(document.createElement('strong'));const t=important?el.firstChild:el;t.textContent=s;};
  const item = (tag,text,cls) => {const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(cls)el.className=cls;return el;};
  const link = (url,label) => {const a=item('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
  const filterInput = s => String(s??'').replace(/[\t\n\r\u0000-\u001f]/g,' ').trim().slice(0,1000);
  const safeHref = (value,kind) => {
    try {
      const u=new URL(value);
      if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return null;
      if(kind==='agenda')return u.hostname==='cityofdallas.legistar.com'&&u.pathname==='/LegislationDetail.aspx'?u.href:null;
      if(kind==='chapter')return u.hostname==='dallastx.new.swagit.com'&&/^\/play\/402001\/\d{1,8}$/.test(u.pathname)&&!u.search?u.href:null;
    } catch (_) {}
    return null;
  };
  function parseCut(source) {
    if(typeof source!=='string'||source.length>2500000)throw Error('Retained source exceeds the 2.5 MB bound.');
    const rows=source.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');
    const observed=[], seen=new Set();let header=false;
    for(let i=0;i<rows.length;i++){
      const line=rows[i];
      if(!line||line[0]==='#')continue;
      if(!header){if(line!==SOURCE_KEYS.join('\t'))throw Error('Official observation cut has an unrecognized header.');header=true;continue;}
      const parts=line.split('\t');
      if(parts.length!==9)throw Error('Invalid native column count at source line '+(i+1));
      const v=Object.fromEntries(SOURCE_KEYS.map((key,k)=>[key,parts[k].trim()]));
      if(!FILE.test(v.file)||!['agenda','chapter'].includes(v.kind)||!safeHref(v.href,v.kind)||
         !/^foreign:sha256:[a-f0-9]{64}$/.test(v.receipt)||v.title.length<6||v.title.length>620||
         !/^\d{4}-\d\d-\d\dT/.test(v.observed)||
         v.source!==(v.kind==='agenda'?'dallas-council-20260923-legistar':'dallas-council-20260923-swagit')){
        throw Error('Exact official provider or receipt coordinate invalid at line '+(i+1));
      }
      const key=v.file+':'+v.kind;
      if(seen.has(key))throw Error('Conflicting duplicate source for '+key);
      seen.add(key);observed.push(v);
      if(observed.length>5000)throw Error('Source set exceeds the 5,000-item local review boundary.');
    }
    if(!header||!observed.length)throw Error('No typed published source records to read.');
    return observed;
  }
  function join(rows) {
    const m=new Map();
    for(const r of rows){
      const v=m.get(r.file)||{file:r.file,agenda:null,chapter:null};
      v[r.kind]=r;m.set(r.file,v);
    }
    return m;
  }
  function find(file) {return fileMap.get(file)||null;}
  function titleOf(row) {
    return (row?.agenda?.title||row?.chapter?.title||row?.file||'Source unavailable').replace(/^(?:Agenda|Swagit indexed video)\s*[^·]{0,55}·\s*/i,'').trim();
  }
  function tm(seconds) {
    if(seconds===null)return '—';
    const h=Math.floor(seconds/3600),m=Math.floor(seconds/60)%60,s=seconds%60;
    return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function seconds(row){
    if(!row?.chapter)return null;
    const m=row.chapter.href.match(/\/play\/402001\/(\d+)$/);return m?Number(m[1]):null;
  }
  function inLens(row,id) {
    const rule=LENSES.find(r=>r.id===id);
    return !rule || rule.match.test(titleOf(row));
  }
  function lensRows(id) {
    const rows=[...fileMap.values()].filter(row=>inLens(row,id));
    return rows.sort((a,b)=>a.file.localeCompare(b.file));
  }
  function selectPath(id,{scroll=true,preferred=null}={}) {
    lens=id;
    story=lensRows(id);
    position=story.findIndex(r=>r.file===preferred);
    if(position<0)position=0;
    const chosen=LENSES.find(v=>v.id===id);
    $('readerPathName').textContent=chosen?chosen.question:'The complete original agenda';
    for(const el of $('pathButtons').querySelectorAll('button[data-path]')){
      el.classList.toggle('active',el.dataset.path===id);
      el.setAttribute('aria-pressed',String(el.dataset.path===id));
    }
    renderContents();renderReader();
    const u=new URL(location.href);
    if(id)u.searchParams.set('thread',id);else u.searchParams.delete('thread');
    history.replaceState(null,'',u.href);
    if(scroll)$('reader').scrollIntoView({behavior:'smooth',block:'start'});
    setStatus('Now reading '+(chosen?chosen.question:'the complete official index')+'. The source remains unchanged.');
  }
  function selectFile(file,{scroll=false,override=false}={}) {
    const r=find(file);if(!r)return;
    let at=story.findIndex(x=>x.file===file);
    if(at<0&&override){lens='';story=lensRows('');at=story.findIndex(x=>x.file===file);
      $('readerPathName').textContent='The complete original agenda';renderContents();
      for(const el of $('pathButtons').querySelectorAll('button'))el.classList.remove('active');
    }
    if(at<0)return;
    position=at;sourceTab='agenda';renderContents();renderReader();
    const u=new URL(location.href);u.searchParams.set('file',file);history.replaceState(null,'',u.href);
    if(scroll)$('reader').scrollIntoView({behavior:'smooth'});
  }
  function current(){return story[position]||null;}
  function renderPaths() {
    const root=$('pathButtons');root.replaceChildren();
    for(const [i,v] of LENSES.entries()){
      const total=lensRows(v.id).length;
      const b=item('button',undefined,'path');b.type='button';b.dataset.path=v.id;
      b.setAttribute('aria-pressed',String(lens===v.id));
      b.append(item('span',String(i+1).padStart(2,'0')));
      const content=item('div');content.append(item('h3',v.name),item('p',v.description));b.append(content);
      b.append(item('span',total+' sources','piece-count'),item('span','↗','arrow'));
      b.addEventListener('click',()=>selectPath(v.id));root.append(b);
    }
    $('pathIntro').textContent='These are keyword entry paths over actual source titles, not machine-verified classifications.';
  }
  function renderContents() {
    const root=$('chapterContents');root.replaceChildren();
    for(const [i,row] of story.entries()){
      const li=item('li');if(i===position)li.className='current';
      const btn=item('button');btn.type='button';
      const n=item('em',String(i+1).padStart(2,'0'));
      const text=item('span',row.file+' · '+titleOf(row).slice(0,165));
      btn.append(n,text);btn.setAttribute('aria-current',i===position?'true':'false');
      btn.addEventListener('click',()=>selectFile(row.file));li.append(btn);root.append(li);
    }
    const active=root.querySelector('.current');if(active)active.scrollIntoView({block:'nearest'});
  }
  function writeSheet(row) {
    const el=$('sourceSheet');el.replaceChildren();if(!row)return;
    const cell=item('div',undefined,'source-eyebrow'),title=item('h3'),lead=item('p');
    const citation=item('div',undefined,'source-cite');
    const addLine=(t,v)=>{const p=item('p');p.append(item('b',t+' '),document.createTextNode(v));citation.append(p);};
    if(sourceTab==='agenda'){
      cell.textContent='OFFICIAL LEGISTAR PUBLICATION';
      title.textContent='Agenda item '+row.file;
      lead.textContent=row.agenda?.title||'The agenda observation is not in this source cut.';
      el.append(cell,title,lead);
      if(row.agenda){
        el.append(link(row.agenda.href,'Read the original item on Legistar ↗'));
        addLine('Source:',row.agenda.source);addLine('Observation:',row.agenda.observed);
      }
    } else if(sourceTab==='media'){
      cell.textContent='OFFICIAL SWAGIT INDEX — NOT A MIRRORED VIDEO';
      title.textContent=row.chapter?'Chapter indexed at '+tm(seconds(row)):'No retained chapter for this item';
      lead.textContent=row.chapter?
        'Swagit advertises an indexed start for '+row.file+'. The saved /play address returned a 404 in independent checks; open the publisher’s full meeting page, where the recording index and transcript are currently presented.':
        'This file has no stored Swagit chapter. That is an absence in this CMS cut, not evidence that council never considered the item.';
      el.append(cell,title,lead,link(PUBLISHER,'Open the publisher’s complete meeting and transcript ↗'));
      if(row.chapter){addLine('Indexed original address:',row.chapter.href);addLine('Indexed start (seconds):',String(seconds(row)));}
    } else {
      cell.textContent='SOURCE LINEAGE / EXACT OWNER';
      title.textContent='What this source can — and cannot — prove';
      lead.textContent='Source records are observations, not findings. The exact file number joins published agenda and video index entries only when both are present; it does not admit a vote, transcript accuracy, media license, parcel title, or authorized effect.';
      el.append(cell,title,lead);
      for(const record of [row.agenda,row.chapter]){
        if(!record)continue;
        addLine(record.kind+' owner:',record.source);
        addLine('Observed:',record.observed);
        addLine('Retained receipt:',record.receipt);
        addLine('Media / use boundary:',record.rights);
        addLine('Assertion state:',record.assertion);
      }
    }
    el.append(citation);
  }
  function renderReader() {
    const row=current();if(!row){$('documentHeading').textContent='No source found for this path';return;}
    $('fileNum').textContent='DALLAS / '+row.file+' / SEP 23 2026';
    $('documentHeading').textContent=titleOf(row);
    $('sourceExplainer').textContent=row.chapter?
       'The official agenda and video index share this file number. Explore the document, inspect its indexed moment, then decide what the sources support.':
       'The agenda is retained, but no corresponding video chapter is in this cut. Read the original and keep that absence visible in your analysis.';
    $('readingLabel').textContent=localCandidate?'LOCAL CANDIDATE · NOT NATIVE-ADMITTED':'PUBLISHED NATIVE SOURCE OBSERVATION';
    $('chapterPosition').textContent=String(position+1)+' / '+story.length+' · '+row.file;
    $('progressBar').style.width=((position+1)/story.length*100)+'%';
    $('prevButton').disabled=position===0;$('nextButton').disabled=position===story.length-1;
    for(const button of $('sourceTabButtons').querySelectorAll('button[data-tab]')){
      button.classList.toggle('selected',button.dataset.tab===sourceTab);
      button.setAttribute('aria-selected',String(button.dataset.tab===sourceTab));
    }
    writeSheet(row);
    const s=seconds(row);
    $('theater').classList.toggle('no-index',s===null);
    $('filmTime').textContent=s===null?'NOT INDEXED':tm(s);
    $('filmStatus').textContent=s===null?'UNKNOWN CHAPTER':'PUBLISHER INDEX @ '+row.file;
    $('filmLabel').textContent=s===null?'The 21 retained chapters contain no exact entry for this file.':
      'Indexed start '+s+' seconds · Source-linked position, not Bonfÿre playback.';
    $('filmLink').href=PUBLISHER;
    $('filmLink').textContent='Visit full official meeting and transcript ↗';
    const decision=decisions.get(row.file);
    for(const [id,kind] of [['keepButton','keep'],['questionButton','question'],['skipButton','skip']]){
      const b=$(id);b.classList.toggle('active',decision?.kind===kind);b.setAttribute('aria-pressed',String(decision?.kind===kind));
    }
    const labels={keep:'IN YOUR READING',question:'QUESTION RETAINED',skip:'LEFT OUT'};
    $('activeDecision').textContent=labels[decision?.kind]||'NOT YET CURATED';
    $('questionPane').classList.toggle('show',decision?.kind==='question');
    $('questionInput').value=decision?.note||'';
  }
  function setDecision(kind){
    const row=current();if(!row)return;
    const old=decisions.get(row.file);
    if(old?.kind===kind&&kind!=='question') {
      decisions.delete(row.file);
      const index=folio.indexOf(row.file);if(index>=0)folio.splice(index,1);
      setStatus(row.file+' removed from this reading.');
    } else {
      const note=old?.note||'';
      decisions.set(row.file,{kind,note});
      const index=folio.indexOf(row.file);
      if(kind==='skip'){if(index>=0)folio.splice(index,1);}
      else if(index<0)folio.push(row.file);
      setStatus(kind==='question'?row.file+' carried forward as an unresolved question.':
        kind==='keep'?row.file+' added to your reading.':row.file+' omitted from your reading.');
    }
    renderReader();renderFolio();renderPaper();
    if(kind==='question')$('questionInput').focus();
  }
  function setQuestion(){
    const row=current();if(!row)return;
    const note=$('questionInput').value.trim();
    if(note.length>900){setStatus('Questions are bounded to 900 characters.',true);return;}
    decisions.set(row.file,{kind:'question',note});
    if(!folio.includes(row.file))folio.push(row.file);
    setStatus(row.file+' question retained with its source; no external action was dispatched.');
    renderFolio();renderPaper();
  }
  function renderFolio(){
    const root=$('folioItems');root.replaceChildren();
    $('folioCount').textContent=folio.length+' original source'+(folio.length===1?'':'s')+' curated';
    if(!folio.length){root.append(item('p','Begin by keeping or questioning a source from the reading room.','quiet'));return;}
    for(const [i,file] of folio.entries()){
      const row=find(file);if(!row)continue;
      const entry=item('div',undefined,'folio-entry');entry.draggable=true;entry.dataset.file=file;
      entry.append(item('span',String(i+1).padStart(2,'0'),'number'));
      const text=item('div');text.append(item('h3',titleOf(row).slice(0,180)),item('small',file+' · '+(decisions.get(file)?.kind==='question'?'NEEDS VERIFICATION':'KEPT SOURCE')));
      entry.append(text);
      const controls=item('div',undefined,'folio-actions');
      for(const [name,move] of [['↑',-1],['↓',1]]){
        const b=item('button',name);b.type='button';b.disabled=i+move<0||i+move>=folio.length;b.setAttribute('aria-label','Move '+file+(move<0?' earlier':' later'));
        b.addEventListener('click',()=>{const other=i+move;[folio[i],folio[other]]=[folio[other],folio[i]];renderFolio();renderPaper();});
        controls.append(b);
      }
      const goto=item('button','Read ↗');goto.type='button';goto.addEventListener('click',()=>selectFile(file,{scroll:true,override:true}));controls.append(goto);
      const rem=item('button','Remove');rem.type='button';rem.addEventListener('click',()=>{decisions.delete(file);folio.splice(folio.indexOf(file),1);renderFolio();renderPaper();renderReader();});
      controls.append(rem);entry.append(controls);
      entry.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',file);entry.classList.add('dragging');});
      entry.addEventListener('dragend',()=>entry.classList.remove('dragging'));
      entry.addEventListener('dragover',e=>e.preventDefault());
      entry.addEventListener('drop',e=>{e.preventDefault();const prior=e.dataTransfer.getData('text/plain');const a=folio.indexOf(prior),b=folio.indexOf(file);if(a<0||b<0||a===b)return;folio.splice(a,1);folio.splice(b,0,prior);renderFolio();renderPaper();});
      root.append(entry);
    }
  }
  const audienceName = {public:'Neighborhood reading',research:'Research edition',operator:'Institutional review',planning:'Planning and housing reading'};
  const modeName = {essay:'An annotated civic reading',sources:'Original source dossier',handoff:'Verification questions for a human reviewer'};
  function buildMemo() {
    const au=$('audienceSelect').value,mode=$('reportMode').value;
    const title=(audienceName[au]||'Research reading')+': Dallas Council · Sep 23, 2026';
    const lines=['# '+title,'','Format: '+(modeName[mode]||mode),'Source: '+(localCandidate?'locally imported candidate cut — not owner-admitted':'Bonfÿre published official-source occurrence snapshot'),
       'Material: September 23, 2026 Dallas City Council agenda and indexed meeting','',
       'This is an independent reading assembled by its user. It does not establish a vote, council decision, title, recording license, or approved task.',''];
    if(!folio.length){lines.push('No sources curated. Select exact agenda files in the reading room.');return lines.join('\n')+'\n';}
    for(const [i,file] of folio.entries()){
      const r=find(file),decision=decisions.get(file);
      if(!r)continue;
      lines.push('## '+String(i+1).padStart(2,'0')+' / '+file,'',titleOf(r),'',
       'Indexed media: '+(r.chapter?'publisher index @ '+tm(seconds(r))+' ('+seconds(r)+' seconds)':'not present in current retained chapter cut'),
       'Position: '+(decision?.kind==='question'?'question under review':'included original source'),'');
      if(decision?.note)lines.push('Reviewer question: '+decision.note,'');
      if($('includeCitations').checked){
        if(r.agenda)lines.push('Legistar: '+r.agenda.href,'Legistar owner: '+r.agenda.source,'Legistar receipt: '+r.agenda.receipt);
        if(r.chapter)lines.push('Swagit retained chapter coordinate (not currently verified playable): '+r.chapter.href,
          'Official meeting and transcript: '+PUBLISHER,'Swagit receipt: '+r.chapter.receipt);
        lines.push('');
      }
      if($('includeGaps').checked)lines.push('Unverified: '+(r.chapter?'timestamp does not prove speech or passage of motion':'video index has no exact match for this file')+'; claims in source wording are agenda assertions, not independently validated outcomes.','');
    }
    lines.push('---','','Release state: PRIVATE REVIEW COPY. Any external effect needs actor authorization, independent source verification and the appropriate Bonfÿre owner.');
    return lines.join('\n')+'\n';
  }
  function renderPaper() {
    const root=$('composedArticle');root.replaceChildren();
    const au=audienceName[$('audienceSelect').value]||'Research reading';
    const mode=$('reportMode').value;
    root.append(item('h3',au+' — '+(modeName[mode]||'Source reading')));
    if(!folio.length){root.append(item('p','Keep a source or a question in the reading room. Your own sequence will become this document.'));return;}
    root.append(item('p','Dallas City Council · 23 September 2026 · '+(localCandidate?'imported review candidate':'native published source snapshot')));
    const intro=item('p','This reading contains '+folio.length+' selected original '+(folio.length===1?'source':'sources')+'. It records a reader’s selection, not a city action.');root.append(intro);
    for(const [i,file] of folio.entries()){
      const row=find(file),state=decisions.get(file);if(!row)continue;
      const section=item('section',undefined,'source-piece'+(state?.kind==='question'?' questioned':''));
      section.append(item('strong',String(i+1).padStart(2,'0')+' / '+file+(state?.kind==='question'?' · QUESTIONED':'')));
      section.append(item('p',titleOf(row)));
      if(state?.note)section.append(item('p','Question to resolve: '+state.note));
      if($('includeGaps').checked)section.append(item('p',row.chapter?
        'The indexed chapter start is '+tm(seconds(row))+', but media playback and agenda action are not verified.':
        'No chapter in the retained video index. This is not evidence of council inaction.'));
      if($('includeCitations').checked){
        const citation=item('p',undefined,'source-footer');
        citation.append(item('span','Source / '));
        if(row.agenda)citation.append(link(row.agenda.href,'Legistar ↗'));
        if(row.chapter)citation.append(document.createTextNode(' · '),link(PUBLISHER,'Swagit meeting ↗'),document.createTextNode(' · '+tm(seconds(row))));
        section.append(citation);
      }
      root.append(section);
    }
    root.append(item('p','Review copy only. No publication, provider dispatch or authority to act follows from this reading.','subhead'));
  }
  function download(text,name,type){
    const b=new Blob([text],{type:type||'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(b),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function exportReview(){
    const lines=['# BONFYRE VERIFICATION / READING HANDOFF, DRAFT ONLY',
       '# Exact native source rows are not overwritten by this local export.',
       'file\tposition\tdecision\tnote\tlegistar_source\tlegistar_receipt\tswagit_source\tswagit_receipt\tindexed_seconds'];
    for(const [i,file] of folio.entries()){
      const r=find(file),s=decisions.get(file);if(!r)continue;
      lines.push([file,i+1,s?.kind||'not-reviewed',s?.note||'',r.agenda?.source||'-',r.agenda?.receipt||'-',
        r.chapter?.source||'-',r.chapter?.receipt||'-',seconds(r)??'-'].map(filterInput).join('\t'));
    }
    download(lines.join('\n')+'\n','dallas-council-review-folio.tsv','text/tab-separated-values;charset=utf-8');
    setStatus('Review candidate exported. No CMS, publisher, provider, operator or external state changed.');
  }
  function makeDifference(other){
    const prior=new Map(original.map(r=>[r.file+':'+r.kind,r]));
    const next=new Map(other.map(r=>[r.file+':'+r.kind,r]));
    const delta=[];
    for(const [k,v] of next){
      const before=prior.get(k);
      if(!before)delta.push({key:k,kind:'new observed candidate'});
      else if(['title','href','receipt','observed','rights','assertion'].some(field=>before[field]!==v[field]))
        delta.push({key:k,kind:'changed source assertion'});
    }
    for(const [k,v] of prior)if(!next.has(k))delta.push({key:k,kind:'absent in imported cut'});
    return delta;
  }
  function renderComparison() {
    const root=$('changeItems');root.replaceChildren();
    $('changesSummary').textContent=localCandidate?
      comparison.length+' source-coordinate differences; candidate not admitted by owner.':
      'Native retained snapshot active. Import a second cut to compare changes.';
    for(const c of comparison.slice(0,150)){
      const p=item('div',undefined,'change-row');
      p.append(item('span',c.key),item('span',c.kind));root.append(p);
    }
    if(comparison.length>150)root.append(item('p',String(comparison.length-150)+' additional changes truncated from visual display.'));
  }
  async function importCandidate(file) {
    if(!file)return;
    try{
      if(file.size>2500000)throw Error('Imported file exceeds 2.5 MB.');
      const next=parseCut(await file.text());
      comparison=makeDifference(next);records=next;fileMap=join(records);
      localCandidate=true;
      renderPaths();
      const selected=story[position]?.file||'';
      selectPath(lens,{scroll:false,preferred:selected});
      renderFolio();renderPaper();renderComparison();
      setStatus('Compared '+next.length+' candidate rows to the native original; '+comparison.length+' differences. Imported data remains unadmitted.');
    }catch(error){setStatus('Import refused: '+error.message,true);}
  }
  function resetCandidate(){
    if(!original.length)return;
    records=original.slice();fileMap=join(records);localCandidate=false;comparison=[];
    $('candidateFile').value='';renderPaths();
    const currentFile=story[position]?.file||'';
    selectPath(lens,{scroll:false,preferred:currentFile});renderFolio();renderPaper();renderComparison();
    setStatus('Restored published native occurrence snapshot; no source or reviewer record changed.');
  }
  function openLookup(){
    if(!$('lookup').open)$('lookup').showModal();
    $('lookupInput').focus();renderLookup();
  }
  function renderLookup(){
    const search=$('lookupInput').value.trim().toLowerCase().slice(0,160);
    const all=[...fileMap.values()].sort((a,b)=>a.file.localeCompare(b.file));
    const found=search?all.filter(r=>(r.file+' '+titleOf(r)).toLowerCase().includes(search)):all.filter(r=>r.chapter);
    const root=$('lookupResults');root.replaceChildren();
    for(const row of found.slice(0,60)){
      const b=item('button');b.type='button';
      b.append(item('em',row.file),item('span',titleOf(row).slice(0,210)));
      b.addEventListener('click',()=>{$('lookup').close();selectFile(row.file,{scroll:true,override:true});});
      root.append(b);
    }
    if(!found.length)root.append(item('p','No source file matches. Use original docket number or agenda words.'));
    if(found.length>60)root.append(item('p',found.length-60+' more; narrow your search.'));
  }
  function shortcuts(e) {
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||$('lookup').open;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openLookup();return;}
    if(typing||e.altKey||e.metaKey||e.ctrlKey)return;
    if(e.key==='/'){e.preventDefault();openLookup();}
    else if(e.key==='ArrowRight'&&position<story.length-1){position++;sourceTab='agenda';renderContents();renderReader();}
    else if(e.key==='ArrowLeft'&&position>0){position--;sourceTab='agenda';renderContents();renderReader();}
    else if(e.key.toLowerCase()==='k')setDecision('keep');
    else if(e.key.toLowerCase()==='q')setDecision('question');
  }
  function listeners() {
    $('openAll').addEventListener('click',()=>selectPath(''));
    for(const id of ['openLookup','readerFind','contentsSearch'])$(id).addEventListener('click',openLookup);
    $('closeLookup').addEventListener('click',()=>$('lookup').close());
    $('lookupInput').addEventListener('input',renderLookup);
    $('lookupInput').addEventListener('keydown',e=>{if(e.key==='Enter'){
      const first=$('lookupResults').querySelector('button');if(first){e.preventDefault();first.click();}
    }});
    $('prevButton').addEventListener('click',()=>{if(position>0){position--;sourceTab='agenda';renderContents();renderReader();}});
    $('nextButton').addEventListener('click',()=>{if(position<story.length-1){position++;sourceTab='agenda';renderContents();renderReader();}});
    $('sourceTabButtons').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;sourceTab=b.dataset.tab;renderReader();});
    $('keepButton').addEventListener('click',()=>setDecision('keep'));
    $('questionButton').addEventListener('click',()=>setDecision('question'));
    $('skipButton').addEventListener('click',()=>setDecision('skip'));
    $('saveQuestion').addEventListener('click',setQuestion);
    $('goCompose').addEventListener('click',()=>$('compose').scrollIntoView({behavior:'smooth'}));
    $('clearFolio').addEventListener('click',()=>{for(const file of folio)decisions.delete(file);folio.length=0;renderFolio();renderPaper();renderReader();setStatus('Folio cleared; native source material is unchanged.');});
    for(const id of ['audienceSelect','reportMode','includeCitations','includeGaps'])$(id).addEventListener('change',renderPaper);
    $('exportMarkdown').addEventListener('click',()=>{
      download(buildMemo(),'dallas-council-'+($('reportMode').value)+'-reading.md','text/markdown;charset=utf-8');
      setStatus('Source reading exported to your device; no publication or provider effect.');
    });
    $('exportTSV').addEventListener('click',exportReview);
    $('copyBrief').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText(buildMemo());setStatus('Cited source reading copied to clipboard.');}
      catch(_){setStatus('Clipboard unavailable in this browser. Use the Markdown export instead.',true);}
    });
    $('candidateFile').addEventListener('change',e=>importCandidate(e.target.files?.[0]));
    $('resetImport').addEventListener('click',resetCandidate);
    document.addEventListener('keydown',shortcuts);
  }
  async function init(){
    listeners();
    try{
      const result=await fetch('./occurrences.tsv',{cache:'no-store'});
      if(!result.ok)throw Error('Canonical published source export is unavailable (HTTP '+result.status+').');
      const observed=parseCut(await result.text());
      const agenda=observed.filter(r=>r.kind==='agenda'),chapter=observed.filter(r=>r.kind==='chapter');
      if(agenda.length!==70||chapter.length!==21)throw Error('Native readback does not match 70 published agenda and 21 video occurrences.');
      original=observed;records=observed.slice();fileMap=join(records);
      renderPaths();
      const query=new URL(location.href),p=query.searchParams.get('thread')||'water',file=query.searchParams.get('file');
      const id=LENSES.some(x=>x.id===p)?p:'';
      selectPath(id,{scroll:false,preferred:FILE.test(file||'')?file:null});
      if(FILE.test(file||'')&&find(file)&&!story.some(r=>r.file===file))selectFile(file,{scroll:false,override:true});
      renderFolio();renderPaper();renderComparison();
      setStatus('Native source cut read: 70 agenda items, 21 retained chapter references. Full publisher meeting is available; saved deep links may not be.');
    }catch(error){
      $('pathButtons').replaceChildren(item('p','Native source read was refused: '+error.message));
      $('documentHeading').textContent='No source authority available.';
      $('sourceSheet').replaceChildren(item('p','The workbench cannot invent missing council records.'));
      setStatus('Source admission blocked: '+error.message,true);
    }
  }
  init();
})();
