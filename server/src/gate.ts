// Fast decision gate ("System One"): ONE tiny Haiku call per FINAL utterance -> typed verdict, no prose.
// Output is a forced tool call with 4 enum/boolean fields so generation stays ~a dozen tokens (~0.7 s).
import type Anthropic from '@anthropic-ai/sdk';
import type { GateKind, GateRequest, GateResponse, TimelineItem, Utterance } from '../../shared/types.ts';
import { isAddressedToMe, mentionsMe } from '../../shared/addressed.ts';
import { FAST_MODEL, getClient, hasAnthropic, speakerName } from './claude.ts';

const GATE_TIMEOUT_MS = 2_500;
// Two wire modes, same typed result:
//  - 'text' (default): 4 space-separated enum tokens ("y h assigned_to_me 1"), max_tokens 12, strictly parsed
//    against the enums below (anything else => regex fallback). Measured ~0.65-0.7 s.
//  - 'tool' (GATE_MODE=tool): forced tool `gate`. Haiku's tool_use costs ~85 output tokens for these 4 fields
//    (measured; max_tokens 12/40/60 all truncate), so it runs ~1.1-1.3 s. Kept for A/B.
export const GATE_MODE: 'text' | 'tool' = process.env.GATE_MODE === 'tool' ? 'tool' : 'text';
export const GATE_MAX_TOKENS = Number(process.env.GATE_MAX_TOKENS) || (GATE_MODE === 'tool' ? 120 : 16); // text: addressed lines use exactly 12 tokens -> 16 = margin
const KINDS = ['decision', 'objection', 'open_question', 'instruction_change', 'assigned_to_me', 'chatter'] as const;
const CONF_P = { high: 0.9, medium: 0.65, low: 0.4 } as const;
type Conf = keyof typeof CONF_P;

const gateTool: Anthropic.Tool = {
  name: 'gate',
  description: 'Classify the TARGET line.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      addressed: { type: 'string', enum: ['yes', 'no'] },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      kind: { type: 'string', enum: [...KINDS] },
      urgent: { type: 'boolean' },
    },
    required: ['addressed', 'confidence', 'kind', 'urgent'],
  },
};

const SYSTEM = `Classify the TARGET line of a live meeting for ME (a deaf/hard-of-hearing user). Call gate only.
addressed=yes if it asks/tells ME something or hands ME a task. Also yes for an open ask to the group ("can someone…", "who wants to…") when CONTEXT links ME to that task (ME did it before, ME's area): kind=assigned_to_me. E.g. CONTEXT "ME ran the retro last month", TARGET "anyone up for running the retro?" => addressed=yes.
addressed=no for lines to the whole group (decisions, opinions, jokes, announcements) that neither name ME nor leave ME a task.
kind: decision (group settles something), objection (pushback/disagreement), open_question (unresolved question or unowned task), instruction_change (plan/time/place changed), assigned_to_me (task given to ME), chatter (anything else).
urgent=true only if ME must respond now.`;
const TEXT_FORMAT = `\nReply with exactly 4 space-separated tokens and nothing else: addressed(y|n) confidence(h|m|l) kind urgent(0|1). Example: y h assigned_to_me 1`;
const ABBR: Record<string, string> = { y: 'yes', n: 'no', h: 'high', m: 'medium', l: 'low' };

/** Strict parse of the text-mode reply; null if any token is off-enum. */
export function parseGateText(raw: string): { addressed: string; confidence: string; kind: string; urgent: boolean } | null {
  const t = raw.trim().toLowerCase().replace(/[^a-z_01 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (t.length < 4) return null;
  const [a, c, k, u] = t;
  if (!['y', 'n'].includes(a) || !['h', 'm', 'l'].includes(c) || !(KINDS as readonly string[]).includes(k) || !['0', '1'].includes(u)) return null;
  return { addressed: ABBR[a], confidence: ABBR[c], kind: k, urgent: u === '1' };
}

// ---- LRU (dedupe client retries) ----
const LRU_MAX = 200;
const lru = new Map<string, Omit<GateResponse, 'latencyMs'>>();
function lruGet(k: string) {
  const v = lru.get(k);
  if (v) { lru.delete(k); lru.set(k, v); }
  return v;
}
function lruSet(k: string, v: Omit<GateResponse, 'latencyMs'>) {
  lru.set(k, v);
  if (lru.size > LRU_MAX) lru.delete(lru.keys().next().value!);
}

const isUtt = (i: TimelineItem): i is Utterance => i.type === 'utterance';

export function gateFallback(req: GateRequest): Omit<GateResponse, 'latencyMs'> {
  const text = req.target?.text ?? '';
  const me = req.me ?? { name: '', aliases: [] };
  const hit = !!me.name && isAddressedToMe(text, me);
  const named = !!me.name && mentionsMe(text, me);
  return { addressed_to_me: hit ? 0.9 : named ? 0.4 : 0.05, kind: 'chatter', kind_p: 0.5, urgent: hit, source: 'fallback' };
}

function buildUser(req: GateRequest): string {
  const sp = req.speakers ?? {};
  const me = req.me;
  const line = (u: Utterance) => `${speakerName(u.speaker, sp)}: ${u.text.trim()}`;
  const ctx = (req.recent ?? []).filter(isUtt).filter((u) => u.final !== false && u.id !== req.target.id && u.text.trim()).slice(-6);
  return [
    `ME: ${me.name}${me.aliases?.length ? ` (aka ${me.aliases.join(', ')})` : ''}`,
    ctx.length ? `CONTEXT:\n${ctx.map(line).join('\n')}` : '',
    `TARGET: ${line(req.target)}`,
  ].filter(Boolean).join('\n');
}

export async function gate(req: GateRequest): Promise<GateResponse> {
  const t0 = Date.now();
  const text = req?.target?.text?.trim() ?? '';
  if (!text) return { addressed_to_me: 0, kind: 'chatter', kind_p: 1, urgent: false, latencyMs: 0, source: 'fallback' };
  const key = `${req.me?.name ?? ''}|${text.toLowerCase()}`;
  const hit = lruGet(key);
  if (hit) return { ...hit, source: 'cache', latencyMs: Date.now() - t0 };
  if (!hasAnthropic()) return { ...gateFallback(req), latencyMs: Date.now() - t0 };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), GATE_TIMEOUT_MS);
  try {
    const base = {
      model: FAST_MODEL, max_tokens: GATE_MAX_TOKENS, temperature: 0,
      messages: [{ role: 'user' as const, content: buildUser(req) }],
    };
    const res = GATE_MODE === 'tool'
      ? await getClient().messages.create(
        { ...base, system: SYSTEM, tools: [gateTool], tool_choice: { type: 'tool', name: 'gate' } },
        { timeout: GATE_TIMEOUT_MS, signal: ac.signal })
      : await getClient().messages.create({ ...base, system: SYSTEM + TEXT_FORMAT }, { timeout: GATE_TIMEOUT_MS, signal: ac.signal });
    let o: { addressed?: string; confidence?: string; kind?: string; urgent?: boolean } | null;
    if (GATE_MODE === 'tool') {
      const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      o = (block?.input ?? null) as typeof o;
    } else {
      const txt = res.content.map((b) => (b.type === 'text' ? b.text : '')).join(' ');
      o = parseGateText(txt);
    }
    if (!o?.addressed || !o.kind) throw new Error(`gate: unparsable ${GATE_MODE} output (stop=${res.stop_reason})`);
    const p = CONF_P[(o.confidence as Conf) ?? 'medium'] ?? 0.65;
    const kind: GateKind = (KINDS as readonly string[]).includes(o.kind) ? (o.kind as GateKind) : 'chatter';
    const out: Omit<GateResponse, 'latencyMs'> = {
      addressed_to_me: o.addressed === 'yes' ? p : +(1 - p).toFixed(2),
      kind, kind_p: p, urgent: !!o.urgent, source: 'model',
    };
    lruSet(key, out);
    const latencyMs = Date.now() - t0;
    console.log(`[gate] ${latencyMs}ms out=${res.usage?.output_tokens}tok ${o.addressed}/${o.confidence} ${kind}${o.urgent ? ' URGENT' : ''} :: ${text.slice(0, 60)}`);
    return { ...out, latencyMs };
  } catch (e) {
    const latencyMs = Date.now() - t0;
    console.warn(`[gate] fallback after ${latencyMs}ms: ${(e as Error)?.message ?? e}`);
    return { ...gateFallback(req), latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

export function registerGate(app: import('fastify').FastifyInstance) {
  app.post<{ Body: GateRequest }>('/api/gate', async (req) => gate(req.body ?? ({} as GateRequest)));
}
