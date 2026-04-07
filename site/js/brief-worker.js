/*
 * BonfyreBrief Web Worker
 *
 * Loads bonfyre-brief.wasm and runs brief_process() in a background thread.
 * Falls back to a pure-JS implementation if WASM isn't available.
 *
 * Messages IN:  { type: 'brief', text: '...', id: '...' }
 * Messages OUT: { type: 'brief', result: '...', id: '...', source: 'wasm'|'js' }
 */

let wasmReady = false;
let briefProcess = null;

// ── Try to load WASM module ──
async function initWasm() {
  try {
    importScripts('../wasm/bonfyre-brief.js');
    const Module = await BonfyreBrief();
    briefProcess = Module.cwrap('brief_process', 'string', ['string']);
    wasmReady = true;
    console.log('[brief-worker] WASM loaded');
  } catch (e) {
    console.log('[brief-worker] WASM not available, using JS fallback:', e.message);
    wasmReady = false;
  }
}

// ── Pure-JS fallback (mirrors the C logic) ──
function briefProcessJS(text) {
  if (!text || !text.trim()) return '# Brief\n\n- No content to summarize.\n';

  const summaryWords = [
    'problem', 'customer', 'market', 'revenue', 'pricing', 'workflow',
    'decision', 'learned', 'traction', 'focus', 'strategy', 'validation',
    'issue', 'broken', 'waiting', 'check', 'urgent', 'left off',
    'handed off', 'heads up', 'watch out', 'note', 'important'
  ];
  const actionWords = [
    'should', 'need to', 'must', 'next', 'plan', 'test', 'focus', 'send',
    'build', 'validate', 'launch', 'review', 'write', 'ship',
    'check on', 'follow up', 'call back', 'restock', 'clean',
    'replace', 'fix', 'order', 'tell', 'remind', 'ask'
  ];

  const containsAny = (s, words) => words.some(w => s.toLowerCase().includes(w));

  const sentences = text
    .split(/[.!?\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1)
    .map(s => {
      let score = 0;
      if (s.length > 30) score++;
      if (s.length > 80) score++;
      if (containsAny(s, summaryWords)) score += 3;
      if (containsAny(s, actionWords)) score += 2;
      if (s.includes('$') || s.includes('percent')) score += 2;
      if (s.includes('I think') || s.includes('yeah')) score -= 2;
      return { text: s, score, isAction: containsAny(s, actionWords) };
    });

  const ranked = [...sentences].sort((a, b) => b.score - a.score);

  let md = '# Shift Handoff Brief\n\n## Key Points\n';
  let summaryN = 0;
  for (const s of ranked) {
    if (summaryN >= 6) break;
    if (s.score < 2 || s.isAction) continue;
    md += `- ${s.text}\n`;
    summaryN++;
  }
  if (!summaryN) md += '- No key points extracted.\n';

  md += '\n## Action Items\n';
  let actionN = 0;
  for (const s of ranked) {
    if (actionN >= 6) break;
    if (!s.isAction) continue;
    md += `- ${s.text}\n`;
    actionN++;
  }
  if (!actionN) md += '- No action items detected.\n';

  md += `\n## Stats\n- Sentences: ${sentences.length}\n- Scored items: ${summaryN}\n- Actions: ${actionN}\n`;
  return md;
}

// ── Message handler ──
self.onmessage = async function(e) {
  if (e.data.type === 'brief') {
    // Init WASM on first use
    if (!wasmReady && briefProcess === null) {
      await initWasm();
    }

    let result;
    let source;

    if (wasmReady && briefProcess) {
      result = briefProcess(e.data.text);
      source = 'wasm';
    } else {
      result = briefProcessJS(e.data.text);
      source = 'js';
    }

    self.postMessage({
      type: 'brief',
      result: result,
      id: e.data.id,
      source: source
    });
  }
};

// ── Pre-init ──
initWasm();
