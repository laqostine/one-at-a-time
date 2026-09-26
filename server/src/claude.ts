import Anthropic from '@anthropic-ai/sdk';
import {
  fmtT,
  type CatchupBullet, type CatchupRequest, type CatchupResponse,
  type LaughRequest, type LaughResponse, type LedgerItem, type LedgerKind,
  type Session, type Speaker, type StateRequest, type StateResponse,
  type TimelineItem, type Utterance,
} from '../../shared/types.ts';

export const CATCHUP_MODEL = 'claude-sonnet-5';
export const FAST_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const TIMEOUT_MS = 12_000;
const RESOLVED_TTL_MS = 3 * 60_000;

let client: Anthropic | null = null;
export const hasAnthropic = () => !!process.env.ANTHROPIC_API_KEY;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
}

// ---------- timeline formatting ----------
export const speakerName = (id: number, speakers: Record<number, Speaker>) =>
  speakers[id]?.name?.trim() || (id < 0 ? 'Unknown' : `Speaker ${id}`);

const isUtt = (i: TimelineItem): i is Utterance => i.type === 'utterance';
const itemT = (i: TimelineItem) => (isUtt(i) ? i.tStart : i.t);

export function formatTimeline(window: TimelineItem[], speakers: Record<number, Speaker>, me: Session['me'] | null): string {
  const header: string[] = [];
  if (me) header.push(`ME: ${me.name}${me.aliases.length ? ` (aliases: ${me.aliases.join(', ')})` : ''}`);
  const ids = new Set<number>(Object.keys(speakers).map(Number));
  for (const i of window) if (isUtt(i)) ids.add(i.speaker);
  header.push(`SPEAKERS: ${[...ids].sort((a, b) => a - b).map((id) => `${id}=${speakers[id]?.name || 'unknown'}`).join(', ')}`);
  const lines = [...window]
    .filter((i) => !isUtt(i) || (i.final !== false && i.text.trim()))
    .sort((a, b) => itemT(a) - itemT(b))
    .map((i) => (isUtt(i)
      ? `[${fmtT(i.tStart)}] ${speakerName(i.speaker, speakers)}: ${i.text.trim()}`
      : `[${fmtT(i.t)}] EVENT ${i.kind}`));
  return [...header, '', ...lines].join('\n');
}

// ---------- shared call helper ----------
const PROMPT_CORE = `Do NOT summarize the whole conversation. Extract only what the person needs to rejoin RIGHT NOW. Name who said what, never "someone". Preserve disagreements and open questions, do not resolve them. A question directed at the user is always first. If people laughed, say what at, in one clause. <=18 words per bullet, <=3 bullets, no preamble. Empty/unintelligible -> empty list, confidence low.`;

async function callTool<T>(model: string, system: string, user: string, tool: Anthropic.Tool): Promise<T> {
  const res = await getClient().messages.create(
    {
      model,
      max_tokens: MAX_TOKENS,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: user }],
    },
    { timeout: TIMEOUT_MS },
  );
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === tool.name);
  if (!block) throw new Error(`no tool_use block (stop_reason=${res.stop_reason})`);
  return block.input as T;
}

const addressedSchema = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        speaker: { type: 'string', description: 'Name of the person who asked' },
        question: { type: 'string', description: 'The question/ask, verbatim or tightly paraphrased' },
        t: { type: 'number', description: 'ms timestamp of the utterance (convert [mm:ss] to ms)' },
      },
      required: ['speaker', 'question', 't'],
    },
  ],
};

// ---------- catch up ----------
const BULLET_KINDS = ['decision_in_progress', 'objection', 'open_question', 'joke', 'event', 'info', 'instruction_change'] as const;
const CONFIDENCE = ['low', 'medium', 'high'] as const;

const catchupTool: Anthropic.Tool = {
  name: 'catch_me_up',
  description: 'Return what the user needs to rejoin the conversation right now.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      addressed_to_me: { ...addressedSchema, description: 'A question/ask directed at ME in the window, else null' },
      bullets: {
        type: 'array', maxItems: 3,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            text: { type: 'string', description: '<=18 words, names who said what' },
            kind: { type: 'string', enum: [...BULLET_KINDS] },
            speaker: { type: 'string' },
            t: { type: 'number', description: 'ms timestamp of the source line' },
            thread: { type: 'string', description: '2-4 word label of the conversation thread this belongs to' },
            replyTo: { type: 'string', description: 'Name of the person this was responding to, if it was a reply' },
          },
          required: ['text', 'kind'],
        },
      },
      open_threads: { type: 'array', maxItems: 3, items: { type: 'string' } },
      confidence: { type: 'string', enum: [...CONFIDENCE] },
    },
    required: ['addressed_to_me', 'bullets', 'open_threads', 'confidence'],
  },
};

const CATCHUP_SYSTEM = `You help a deaf or hard-of-hearing person recover what they missed in a live group conversation. ${PROMPT_CORE}
Timestamps in the transcript are [mm:ss]; when you return t, give milliseconds since session start (mm*60000 + ss*1000).
ME is the user. Only fill addressed_to_me if someone asked ME (by name/alias or clear second-person address) something still unanswered.
For each bullet set thread (2-4 word label; parallel conversations get different labels) and replyTo (who it answered) so the user sees who was responding to whom. If a decision or instruction changed, say why.`;

const emptyCatchup = (): CatchupResponse => ({ addressed_to_me: null, bullets: [], open_threads: [], confidence: 'low' });

function cleanAddressed(a: unknown): CatchupResponse['addressed_to_me'] {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  if (typeof o.question !== 'string' || !o.question.trim()) return null;
  return { speaker: String(o.speaker ?? 'Unknown'), question: o.question.trim(), t: Number(o.t) || 0 };
}

export async function catchUp(req: CatchupRequest): Promise<CatchupResponse> {
  const window = req.window ?? [];
  if (!window.some((i) => isUtt(i) && i.text.trim())) return emptyCatchup();
  if (!hasAnthropic()) return mockCatchup(req);
  try {
    const user = `Window ${fmtT(req.sinceT)}–${fmtT(req.nowT)} (what I missed):\n\n${formatTimeline(window, req.speakers ?? {}, req.me)}`;
    const out = await callTool<Partial<CatchupResponse>>(CATCHUP_MODEL, CATCHUP_SYSTEM, user, catchupTool);
    const bullets: CatchupBullet[] = (Array.isArray(out.bullets) ? out.bullets : []).slice(0, 3)
      .filter((b) => b && typeof b.text === 'string' && b.text.trim())
      .map((b) => ({
        text: b.text.trim(),
        kind: (BULLET_KINDS as readonly string[]).includes(b.kind) ? b.kind : 'info',
        ...(b.speaker ? { speaker: String(b.speaker) } : {}),
        ...(typeof b.t === 'number' ? { t: b.t } : {}),
        ...(b.thread ? { thread: String(b.thread) } : {}),
        ...(b.replyTo ? { replyTo: String(b.replyTo) } : {}),
      }));
    return {
      addressed_to_me: cleanAddressed(out.addressed_to_me),
      bullets,
      open_threads: (Array.isArray(out.open_threads) ? out.open_threads : []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 3),
      confidence: (CONFIDENCE as readonly string[]).includes(out.confidence as string) ? out.confidence! : 'low',
    };
  } catch (err) {
    console.error('[catchUp] error:', (err as Error).message);
    return emptyCatchup();
  }
}

// ---------- state extraction ----------
const LEDGER_KINDS = ['decision', 'objection', 'open_question', 'assigned_to_me', 'instruction_change'] as const;

const stateTool: Anthropic.Tool = {
  name: 'update_ledger',
  description: 'Return the full UPDATED ledger of what is open on the table, plus any question to ME in the last utterance(s).',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ledger: {
        type: 'array', maxItems: 8,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Existing id if this is the same item as an existing ledger entry; "new" for a new item' },
            kind: { type: 'string', enum: [...LEDGER_KINDS] },
            text: { type: 'string', description: '<=14 words' },
            speaker: { type: 'string', description: 'Name of the person who raised it' },
            t: { type: 'number', description: 'ms timestamp of the source line' },
            resolved: { type: 'boolean' },
            reason: { type: 'string', description: 'For decisions/instruction changes: the WHY given, <=12 words, or omit' },
            thread: { type: 'string', description: '2-4 word label of the conversation thread (parallel conversations get different labels)' },
            replyTo: { type: 'string', description: 'Name of the person this item was responding to, if any' },
          },
          required: ['id', 'kind', 'text', 't', 'resolved'],
        },
      },
      addressed_to_me_now: addressedSchema,
    },
    required: ['ledger', 'addressed_to_me_now'],
  },
};

const STATE_SYSTEM = `You maintain a live ledger of what is "open on the table" in a group conversation, for a deaf or hard-of-hearing user (ME). ${PROMPT_CORE}
Ledger kinds: decision (a decision forming or made — ALWAYS capture the reason given), objection (someone pushing back), open_question (unanswered question to the group), assigned_to_me (a task/ask given to ME), instruction_change (a plan, time, place or instruction that changed from what was said before).
Threads: several conversations can run at once. Give each item a short thread label (2-4 words) so parallel threads are distinguishable, and set replyTo when the item was a response to a specific person.
Rules:
- Return the FULL updated ledger (max 8 items), merging with EXISTING.
- If an item is the same as an existing one (even if reworded), reuse its id and keep its wording unless it materially changed.
- If the conversation resolved an item (answered, agreed, withdrawn), keep it with resolved:true.
- New items get id "new".
- speaker = the person's name as shown in the transcript. t = ms since session start (mm*60000 + ss*1000).
- Do not resolve disagreements yourself; an objection stays open until the people resolve it.
- addressed_to_me_now: only if the LAST utterance(s) put a question/ask to ME (by name/alias or clear second-person address) that is not yet answered; else null.`;

function mergeLedger(raw: unknown[], existing: LedgerItem[], nowT: number): LedgerItem[] {
  const byId = new Map(existing.map((e) => [e.id, e]));
  const stamp = Date.now();
  const out: LedgerItem[] = [];
  raw.forEach((r, i) => {
    if (!r || typeof r !== 'object') return;
    const o = r as Record<string, unknown>;
    const kind = String(o.kind) as LedgerKind;
    if (!(LEDGER_KINDS as readonly string[]).includes(kind) || typeof o.text !== 'string' || !o.text.trim()) return;
    const prev = typeof o.id === 'string' ? byId.get(o.id) : undefined;
    const item: LedgerItem = {
      id: prev ? prev.id : `ledger-${stamp}-${i}`,
      kind,
      text: o.text.trim(),
      t: prev ? prev.t : (Number(o.t) || nowT),
      resolved: !!o.resolved,
    };
    const speaker = typeof o.speaker === 'string' && o.speaker.trim() ? o.speaker.trim() : prev?.speaker;
    if (speaker) item.speaker = speaker;
    for (const k of ['reason', 'thread', 'replyTo'] as const) {
      const v = typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string).trim() : prev?.[k];
      if (v) item[k] = v;
    }
    out.push(item);
  });
  const seen = new Set<string>();
  return out
    .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
    .filter((it) => !(it.resolved && nowT - it.t > RESOLVED_TTL_MS))
    .slice(0, 8);
}

export async function extractState(req: StateRequest): Promise<StateResponse> {
  const existing = req.existing ?? [];
  const safe: StateResponse = { ledger: existing, addressed_to_me_now: null };
  const window = req.window ?? [];
  if (!window.some((i) => isUtt(i) && i.text.trim())) return safe;
  if (!hasAnthropic()) return mockState(req);
  try {
    const ex = existing.length
      ? existing.map((e) => `- id=${e.id} kind=${e.kind} speaker=${e.speaker ?? '?'} t=${e.t} resolved=${!!e.resolved}: ${e.text}`).join('\n')
      : '(empty)';
    const user = `EXISTING LEDGER:\n${ex}\n\nNOW: ${fmtT(req.nowT)}\n\nTRANSCRIPT:\n${formatTimeline(window, req.speakers ?? {}, req.me)}`;
    const out = await callTool<{ ledger?: unknown[]; addressed_to_me_now?: unknown }>(FAST_MODEL, STATE_SYSTEM, user, stateTool);
    return {
      ledger: mergeLedger(Array.isArray(out.ledger) ? out.ledger : [], existing, req.nowT),
      addressed_to_me_now: cleanAddressed(out.addressed_to_me_now),
    };
  } catch (err) {
    console.error('[extractState] error:', (err as Error).message);
    return safe;
  }
}

// ---------- laughter ----------
const laughTool: Anthropic.Tool = {
  name: 'explain_laugh',
  description: 'Explain in one line what the group laughed at.',
  input_schema: {
    type: 'object', additionalProperties: false,
    properties: {
      line: { type: ['string', 'null'], description: '"They laughed at <speaker>\'s ..." <=14 words, or null if unclear' },
    },
    required: ['line'],
  },
};

const LAUGH_SYSTEM = `A deaf or hard-of-hearing user saw the group laugh. Using the transcript just before the laughter event, say what they laughed at in ONE line of <=14 words, starting "They laughed at", naming the speaker. If it is unclear, return null. No preamble.`;

export async function explainLaugh(req: LaughRequest): Promise<LaughResponse> {
  const window = (req.window ?? []).filter((i) => itemT(i) <= req.t + 1500);
  if (!window.some((i) => isUtt(i) && i.text.trim())) return { line: null };
  if (!hasAnthropic()) return mockLaugh(req);
  try {
    const user = `Laughter at ${fmtT(req.t)}.\n\n${formatTimeline(window.slice(-12), req.speakers ?? {}, null)}`;
    const out = await callTool<{ line?: unknown }>(FAST_MODEL, LAUGH_SYSTEM, user, laughTool);
    const line = typeof out.line === 'string' && out.line.trim() ? out.line.trim() : null;
    return { line };
  } catch (err) {
    console.error('[explainLaugh] error:', (err as Error).message);
    return { line: null };
  }
}

// ---------- deterministic mocks (no API key) ----------
const lastUtts = (w: TimelineItem[], n: number) =>
  w.filter((i): i is Utterance => isUtt(i) && i.final !== false && !!i.text.trim()).sort((a, b) => a.tStart - b.tStart).slice(-n);
const clip = (s: string, words: number) => { const w = s.trim().split(/\s+/); return w.length > words ? `${w.slice(0, words).join(' ')}…` : s.trim(); };
const mentionsMe = (text: string, me: Session['me']) => {
  const names = [me.name, ...me.aliases].filter(Boolean).map((n) => n.toLowerCase());
  const t = text.toLowerCase();
  return names.some((n) => t.includes(n)) && /\?|can you|could you|will you/.test(t);
};

function mockCatchup(req: CatchupRequest): CatchupResponse {
  const utts = lastUtts(req.window, 3);
  const toMe = [...req.window].reverse().find((i): i is Utterance => isUtt(i) && mentionsMe(i.text, req.me));
  return {
    addressed_to_me: toMe ? { speaker: speakerName(toMe.speaker, req.speakers), question: toMe.text, t: toMe.tStart } : null,
    bullets: utts.map((u) => ({
      text: clip(u.text, 16),
      kind: u.text.includes('?') ? 'open_question' : 'info',
      speaker: speakerName(u.speaker, req.speakers),
      t: u.tStart,
    })),
    open_threads: utts.filter((u) => u.text.includes('?')).map((u) => clip(u.text, 12)).slice(0, 3),
    confidence: 'low',
  };
}

function mockState(req: StateRequest): StateResponse {
  const ledger = [...(req.existing ?? [])];
  const known = new Set(ledger.map((l) => l.text));
  const stamp = Date.now();
  lastUtts(req.window, 3).forEach((u, i) => {
    const text = clip(u.text, 14);
    if (known.has(text)) return;
    const kind: LedgerKind = mentionsMe(u.text, req.me) ? 'assigned_to_me'
      : /\b(no|but|disagree|not yet|still)\b/i.test(u.text) ? 'objection'
      : u.text.includes('?') ? 'open_question' : 'decision';
    ledger.push({ id: `ledger-${stamp}-${i}`, kind, text, speaker: speakerName(u.speaker, req.speakers), t: u.tStart, resolved: false });
  });
  const last = lastUtts(req.window, 1)[0];
  return {
    ledger: ledger.slice(-8),
    addressed_to_me_now: last && mentionsMe(last.text, req.me)
      ? { speaker: speakerName(last.speaker, req.speakers), question: last.text, t: last.tStart } : null,
  };
}

function mockLaugh(req: LaughRequest): LaughResponse {
  const u = lastUtts(req.window.filter((i) => itemT(i) <= req.t), 1)[0];
  return { line: u ? `They laughed at ${speakerName(u.speaker, req.speakers)}'s "${clip(u.text, 8)}"` : null };
}
