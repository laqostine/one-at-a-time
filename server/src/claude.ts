import Anthropic from '@anthropic-ai/sdk';
import {
  fmtT,
  type CatchupBullet, type CatchupRequest, type CatchupResponse,
  type LaughRequest, type LaughResponse, type LedgerItem, type LedgerKind,
  type Session, type Speaker, type StateRequest, type StateResponse,
  type Thread, type TimelineItem, type Utterance, type UtteranceThread,
} from '../../shared/types.ts';
import { matchThread, threadSlug } from '../../shared/threads.ts';

export const CATCHUP_MODEL = 'claude-sonnet-5';
export const FAST_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const TIMEOUT_MS = 12_000;
/** Per-route budgets (all attempts incl. the one retry). The client polls /api/state every 8 s. */
export const STATE_BUDGET_MS = 8_000; // steady state is ~2-4 s; a cold full window (no lanes yet) can take ~6 s
export const CATCHUP_BUDGET_MS = 10_000;
const RESOLVED_TTL_MS = 3 * 60_000;

let client: Anthropic | null = null;
export const hasAnthropic = () => !!process.env.ANTHROPIC_API_KEY;
export function getClient(): Anthropic {
  if (!client) {
    const ws = process.env.ANTHROPIC_WORKSPACE_ID;
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0,
      ...(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {}),
    });
  }
  return client;
}

// ---------- timeline formatting ----------
export const speakerName = (id: number, speakers: Record<number, Speaker>) =>
  speakers[id]?.name?.trim() || (id < 0 ? 'Unknown' : `Speaker ${id}`);

const isUtt = (i: TimelineItem): i is Utterance => i.type === 'utterance';
const itemT = (i: TimelineItem) => (isUtt(i) ? i.tStart : i.t);

/** threadLabel: when given (ledger calls), lines already stamped with a lane show it as «label»; unstamped lines get a leading "*". */
export function formatTimeline(window: TimelineItem[], speakers: Record<number, Speaker>, me: Session['me'] | null, threadLabel?: (id: string) => string | undefined): string {
  const header: string[] = [];
  if (me) header.push(`ME: ${me.name}${me.aliases.length ? ` (aliases: ${me.aliases.join(', ')})` : ''}`);
  const ids = new Set<number>(Object.keys(speakers).map(Number));
  for (const i of window) if (isUtt(i)) ids.add(i.speaker);
  header.push(`SPEAKERS: ${[...ids].sort((a, b) => a - b).map((id) => `${id}=${speakers[id]?.name || 'unknown'}`).join(', ')}`);
  const lines = [...window]
    .filter((i) => !isUtt(i) || (i.final !== false && i.text.trim()))
    .sort((a, b) => itemT(a) - itemT(b))
    .map((i) => (isUtt(i)
      ? threadLabel
        ? (() => { const l = i.threadId ? threadLabel(i.threadId) : undefined; return l ? `[${fmtT(i.tStart)}] ${speakerName(i.speaker, speakers)}: ${i.text.trim()} «${l}»` : `*[${fmtT(i.tStart)}] ${speakerName(i.speaker, speakers)}: ${i.text.trim()}`; })()
        : `[${fmtT(i.tStart)}] ${speakerName(i.speaker, speakers)}: ${i.text.trim()}`
      : `[${fmtT(i.t)}] EVENT ${i.kind}`));
  return [...header, '', ...lines].join('\n');
}

// ---------- shared call helper ----------
const PROMPT_CORE = `Do NOT summarize the whole conversation. Extract only what the person needs to rejoin RIGHT NOW. Name who said what, never "someone". Preserve disagreements and open questions, do not resolve them. A question directed at the user is always first. If people laughed, say what at, in one clause. <=18 words per bullet, <=3 bullets, no preamble. Empty/unintelligible -> empty list, confidence low.`;

/** Retry once after 300 ms on transient failures (429/5xx/529 overloaded, connection resets), inside the route's budget. */
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 300;
export function isRetryable(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (typeof status === 'number') return status === 408 || status === 409 || status === 429 || status >= 500;
  const name = (e as Error)?.name ?? '';
  return /APIConnectionError|APIConnectionTimeoutError|FetchError|ECONNRESET|socket hang up/i.test(`${name} ${(e as Error)?.message ?? ''}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CallOpts { budgetMs?: number; label?: string }
/** Runs `attempt(timeoutMs)` with up to MAX_RETRIES retries, never exceeding budgetMs in total. */
export async function withRetry<T>(label: string, budgetMs: number, attempt: (timeoutMs: number) => Promise<T>): Promise<T> {
  const deadline = Date.now() + budgetMs;
  for (let n = 0; ; n++) {
    try {
      return await attempt(Math.max(500, deadline - Date.now()));
    } catch (e) {
      const left = deadline - Date.now();
      if (n >= MAX_RETRIES || !isRetryable(e) || left < RETRY_DELAY_MS + 800) throw e;
      console.warn(`[claude] ${label} retry ${n + 1} after ${(e as Error)?.message ?? e} (${left}ms left)`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}

export async function callTool<T>(model: string, system: string, user: string, tool: Anthropic.Tool, maxTokens = MAX_TOKENS, opts: CallOpts = {}): Promise<T> {
  const label = opts.label ?? tool.name;
  const t0 = Date.now();
  const res = await withRetry(label, opts.budgetMs ?? TIMEOUT_MS, (timeout) => getClient().messages.create(
    {
      model,
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: user }],
    },
    { timeout, maxRetries: 0 },
  ));
  console.log(`[claude] ${label} ${Date.now() - t0}ms in=${res.usage?.input_tokens} out=${res.usage?.output_tokens} stop=${res.stop_reason}`);
  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === tool.name);
  if (!block) throw new Error(`no tool_use block (stop_reason=${res.stop_reason})`);
  if (res.stop_reason === 'max_tokens') throw new Error(`${label}: output truncated at max_tokens=${maxTokens}`);
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
    const out = await callTool<Partial<CatchupResponse>>(CATCHUP_MODEL, CATCHUP_SYSTEM, user, catchupTool, MAX_TOKENS, { budgetMs: CATCHUP_BUDGET_MS, label: 'catchup' });
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
    return { ...emptyCatchup(), degraded: true };
  }
}

// ---------- state extraction ----------
const MAX_UTT_THREADS = 10; // only the newest lines get lane labels per call; older ones keep their stamp client-side
const STATE_MAX_TOKENS = 1000;
const LEDGER_KINDS = ['decision', 'objection', 'open_question', 'assigned_to_me', 'instruction_change'] as const;

const stateTool: Anthropic.Tool = {
  name: 'update_ledger',
  description: 'Return only NEW or CHANGED ledger items (unchanged existing items are kept automatically), plus any question to ME in the last utterance(s).',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ledger: {
        type: 'array', maxItems: 5, // new/changed items only (see mergeLedger); bounds output tokens -> latency
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'Existing id if this is the same item as an existing ledger entry; "new" for a new item' },
            kind: { type: 'string', enum: [...LEDGER_KINDS] },
            text: { type: 'string', description: '<=14 words' },
            speaker: { type: 'string', description: 'Name of the person who raised it' },
            t: { type: 'number', description: 'ms timestamp of the source line' },
            resolved: { type: 'boolean' },
            reason: { type: 'string', description: 'For decisions/instruction changes ONLY: the reason a person actually said, as they said it, <=6 plain words (e.g. "nonna can\'t do evenings"); omit if nobody gave one' },
            thread: { type: 'string', description: '2-4 word label of the conversation thread (parallel conversations get different labels)' },
            replyTo: { type: 'string', description: 'Name of the person this item was responding to, if any' },
          },
          required: ['id', 'kind', 'text', 't', 'resolved'],
        },
      },
      drop: { type: 'array', items: { type: 'string' }, description: 'Existing ids that are duplicates or no longer true (rare)' },
      addressed_to_me_now: addressedSchema,
      utterance_threads: {
        type: 'array', maxItems: MAX_UTT_THREADS,
        description: 'One entry per transcript line marked * (not yet labeled), newest first if you must drop some: which thread it belongs to and who it replied to',
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            t: { type: 'number', description: 'ms timestamp of the line (mm*60000 + ss*1000)' },
            thread: { type: 'string', description: '2-4 word thread label; reuse an EXISTING THREADS label when it is the same conversation' },
            replyTo: { type: 'string', description: 'Name of the person this line answered, if it was a reply' },
          },
          required: ['t', 'thread'],
        },
      },
    },
    required: ['ledger', 'addressed_to_me_now', 'utterance_threads'],
  },
};

const STATE_SYSTEM = `You maintain a live ledger of what is "open on the table" in a group conversation, for a deaf or hard-of-hearing user (ME). ${PROMPT_CORE}
Ledger kinds: decision (a decision forming or made — ALWAYS capture the reason given), objection (someone pushing back), open_question (unanswered question to the group), assigned_to_me (a task/ask given to ME), instruction_change (a plan, time, place or instruction that changed from what was said before).
Threads: several conversations can run at once. Give each item a short thread label (2-4 words) so parallel threads are distinguishable, and set replyTo when the item was a response to a specific person.
Rules:
- Return ONLY new items and existing items that changed (kind, text, resolved or reason), reusing the existing id. Unchanged EXISTING items are kept automatically: do NOT repeat them. Put an existing id in drop only if it is a duplicate or no longer true.
- If an item is the same as an existing one (even if reworded), it is not new: reuse its id, and only return it if it materially changed.
- If the conversation resolved an item (answered, agreed, withdrawn), return it with resolved:true.
- New items get id "new".
- speaker = the person's name as shown in the transcript. t = ms since session start (mm*60000 + ss*1000).
- Do not resolve disagreements yourself; an objection stays open until the people resolve it.
- utterance_threads: ONLY for transcript lines starting with "*" (not yet labeled; newest first if more than 10): give t, its thread label and replyTo. Lines ending in «label» are already labeled: do not repeat them. Use the SAME label for the same conversation; reuse EXISTING THREADS / «label» labels verbatim when they still apply. Side conversations get their own label.
- Keep it short: ledger text <=12 words, reason <=10 words, omit optional fields you don't need.
- addressed_to_me_now: only if the LAST utterance(s) put a question/ask to ME (by name/alias or clear second-person address) that is not yet answered; else null.`;

/**
 * The model returns only new/changed items (+ drop ids); unchanged EXISTING items carry over. Returning the full ledger
 * every 8 s was ~60% of the output tokens and the main reason /api/state ran 5.5-6.5 s.
 */
function mergeLedger(raw: unknown[], existing: LedgerItem[], nowT: number, drop: unknown[] = []): LedgerItem[] {
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
  const dropped = new Set(drop.filter((d): d is string => typeof d === 'string'));
  const changed = new Set(out.map((o) => o.id));
  for (const e of existing) if (!changed.has(e.id) && !dropped.has(e.id)) out.push(e);
  const seen = new Set<string>();
  let items = out
    .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
    .filter((it) => !dropped.has(it.id))
    .filter((it) => !(it.resolved && nowT - it.t > RESOLVED_TTL_MS))
    .sort((a, b) => a.t - b.t);
  // Cap at 8: shed the oldest resolved items first, then the oldest open ones.
  while (items.length > 8) {
    const i = items.findIndex((it) => it.resolved);
    items = items.filter((_, k) => k !== (i >= 0 ? i : 0));
  }
  return items;
}

export async function extractState(req: StateRequest): Promise<StateResponse> {
  const existing = req.existing ?? [];
  const safe: StateResponse = { ledger: existing, addressed_to_me_now: null, threads: req.existing_threads ?? [], utteranceThreads: [] };
  const window = req.window ?? [];
  if (!window.some((i) => isUtt(i) && i.text.trim())) return safe;
  if (!hasAnthropic()) return mockState(req);
  try {
    const ex = existing.length
      ? existing.map((e) => `- id=${e.id} kind=${e.kind} speaker=${e.speaker ?? '?'} t=${e.t} resolved=${!!e.resolved}: ${e.text}`).join('\n')
      : '(empty)';
    const th = (req.existing_threads ?? []).map((t) => `- ${t.label}`).join('\n') || '(none)';
    const labels = new Map((req.existing_threads ?? []).map((t) => [t.id, t.label]));
    const user = `EXISTING LEDGER:\n${ex}\n\nEXISTING THREADS:\n${th}\n\nNOW: ${fmtT(req.nowT)}\n\nTRANSCRIPT:\n${formatTimeline(window, req.speakers ?? {}, req.me, (id) => labels.get(id))}`;
    const out = await callTool<{ ledger?: unknown[]; drop?: unknown[]; addressed_to_me_now?: unknown; utterance_threads?: unknown[] }>(
      FAST_MODEL, STATE_SYSTEM, user, stateTool, STATE_MAX_TOKENS, { budgetMs: STATE_BUDGET_MS, label: 'state' });
    const ledger = mergeLedger(Array.isArray(out.ledger) ? out.ledger : [], existing, req.nowT, Array.isArray(out.drop) ? out.drop : []);
    return {
      ...assignThreads(req, Array.isArray(out.utterance_threads) ? out.utterance_threads : [], ledger),
      addressed_to_me_now: cleanAddressed(out.addressed_to_me_now),
    };
  } catch (err) {
    console.error('[extractState] error:', (err as Error).message);
    return { ...safe, degraded: true };
  }
}

// ---------- threads (lanes) ----------
const MAX_THREADS = 8;
const LEDGER_SNAP_MS = 30_000; // ledger item with no thread label -> lane of the nearest line within 30 s

const finalsOf = (w: TimelineItem[]) =>
  w.filter((i): i is Utterance => isUtt(i) && i.final !== false && !!i.text.trim()).sort((a, b) => a.tStart - b.tStart);

/**
 * Turn raw model labels into stable thread ids (fuzzy-merged with existing_threads), snap each
 * utterance_threads.t to the exact tStart of a final in the window, stamp threadId on ledger items,
 * and recompute participants / lastT / openCount.
 */
export function assignThreads(req: StateRequest, raw: unknown[], ledgerIn: LedgerItem[]): Pick<StateResponse, 'ledger' | 'threads' | 'utteranceThreads'> {
  const speakers = req.speakers ?? {};
  const known: Thread[] = (req.existing_threads ?? [])
    .filter((t) => t && typeof t.id === 'string' && typeof t.label === 'string')
    .map((t) => ({ ...t, participants: [...(t.participants ?? [])], openCount: 0 }));
  const byId = new Map(known.map((t) => [t.id, t]));
  const resolve = (label: string): string => {
    const hit = matchThread(label, known);
    if (hit) return hit;
    let id = threadSlug(label);
    for (let k = 2; byId.has(id); k++) id = `${threadSlug(label)}-${k}`;
    const t: Thread = { id, label: label.trim().slice(0, 40), participants: [], lastT: 0, openCount: 0 };
    known.push(t); byId.set(id, t);
    return id;
  };
  const touch = (id: string, name: string | undefined, t: number) => {
    const th = byId.get(id);
    if (!th) return;
    if (name && name !== 'Unknown' && !th.participants.includes(name)) th.participants.push(name);
    th.lastT = Math.max(th.lastT, t);
  };

  // Only lines not yet stamped with a known lane are labeled (see the "*" marker in formatTimeline): the old way re-labeled
  // the newest 14 lines on every call, ~350 of the ~1000 output tokens, and pushed /api/state past 6 s.
  const all = finalsOf(req.window ?? []);
  const unlabeled = all.filter((u) => !(u.threadId && byId.has(u.threadId)));
  const finals = (unlabeled.length ? unlabeled : all).slice(-MAX_UTT_THREADS);
  const used = new Set<Utterance>();
  const utteranceThreads: UtteranceThread[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const label = typeof o.thread === 'string' ? o.thread.trim() : '';
    const t = Number(o.t);
    if (!label || !Number.isFinite(t)) continue;
    // Model sees [mm:ss] (floored), so the real tStart is in [t, t+999]: aim for the middle.
    let best: Utterance | undefined, bestD = Infinity;
    for (const u of finals) {
      if (used.has(u)) continue;
      const d = Math.abs(u.tStart - (t + 500));
      if (d < bestD) { best = u; bestD = d; }
    }
    if (!best || bestD > 1_500) continue;
    used.add(best);
    const threadId = resolve(label);
    const replyTo = typeof o.replyTo === 'string' && o.replyTo.trim() ? o.replyTo.trim() : undefined;
    utteranceThreads.push({ t: best.tStart, threadId, ...(replyTo ? { replyTo } : {}) });
    touch(threadId, speakerName(best.speaker, speakers), best.tStart);
  }
  utteranceThreads.sort((a, b) => a.t - b.t);

  const ledger = ledgerIn.map((it) => {
    let threadId = it.thread ? resolve(it.thread) : undefined;
    if (!threadId) {
      let bestD = LEDGER_SNAP_MS;
      for (const ut of utteranceThreads) { const d = Math.abs(ut.t - it.t); if (d <= bestD) { bestD = d; threadId = ut.threadId; } }
    }
    if (!threadId) threadId = it.threadId && byId.has(it.threadId) ? it.threadId : undefined;
    if (!threadId) return it;
    touch(threadId, it.speaker, it.t);
    const th = byId.get(threadId);
    if (th && !it.resolved) th.openCount++;
    return { ...it, threadId };
  });

  const threads = known
    .filter((t) => t.lastT > 0 || t.openCount > 0)
    .sort((a, b) => b.lastT - a.lastT)
    .slice(0, MAX_THREADS);
  return { ledger, threads, utteranceThreads };
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
    const out = await callTool<{ line?: unknown }>(FAST_MODEL, LAUGH_SYSTEM, user, laughTool, MAX_TOKENS, { budgetMs: 5_000, label: 'laugh' });
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
  // Mock lanes: everything is one "General" thread; replyTo = previous speaker when it changed.
  const finals = finalsOf(req.window).slice(-MAX_UTT_THREADS);
  const raw = finals.map((u, i) => {
    const prev = finals[i - 1];
    const replyTo = prev && prev.speaker !== u.speaker ? speakerName(prev.speaker, req.speakers) : undefined;
    return { t: Math.floor(u.tStart / 1000) * 1000, thread: 'General', ...(replyTo ? { replyTo } : {}) };
  });
  return {
    ...assignThreads(req, raw, ledger.slice(-8).map((l) => ({ ...l, thread: l.thread ?? 'General' }))),
    addressed_to_me_now: last && mentionsMe(last.text, req.me)
      ? { speaker: speakerName(last.speaker, req.speakers), question: last.text, t: last.tStart } : null,
  };
}

function mockLaugh(req: LaughRequest): LaughResponse {
  const u = lastUtts(req.window.filter((i) => itemT(i) <= req.t), 1)[0];
  return { line: u ? `They laughed at ${speakerName(u.speaker, req.speakers)}'s "${clip(u.text, 8)}"` : null };
}
