// "Speak for me": draft short spoken lines that let a deaf/HoH user (ME) re-enter the
// conversation right now. The client speaks the chosen line aloud at the next silence gap.
import type Anthropic from '@anthropic-ai/sdk';
import {
  type InterjectIntent, type InterjectOption, type InterjectRequest, type InterjectResponse,
  type LedgerItem, type TimelineItem, type Utterance,
} from '../../shared/types.ts';
import { callTool, FAST_MODEL, formatTimeline, hasAnthropic, speakerName } from './claude.ts';

const WINDOW_MS = 60_000;
const MAX_WORDS = 14;
const KINDS = ['object', 'question', 'clarify', 'agree', 'custom'] as const;

const isUtt = (i: TimelineItem): i is Utterance => i.type === 'utterance';
const itemEnd = (i: TimelineItem) => (isUtt(i) ? i.tEnd : i.t);

const interjectTool: Anthropic.Tool = {
  name: 'draft_interjections',
  description: 'Return up to 3 short lines ME could say out loud right now to re-enter the conversation.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      options: {
        type: 'array', minItems: 1, maxItems: 3,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            label: { type: 'string', description: '1-3 word button label, e.g. "Object", "Ask back", "Repeat?", "I\'ll take it"' },
            line: { type: 'string', description: `The exact sentence to be spoken aloud, first person, <=${MAX_WORDS} words` },
            kind: { type: 'string', enum: [...KINDS] },
          },
          required: ['label', 'line', 'kind'],
        },
      },
    },
    required: ['options'],
  },
};

const SYSTEM = `You write lines for a deaf or hard-of-hearing person (ME) in a fast live group conversation. ME cannot easily break in by voice, so a text-to-speech voice will say ME's line out loud at the next pause.
Draft up to 3 alternative lines ME could say RIGHT NOW to rejoin, each a different move:
- object: flag a concern before a forming decision locks ("Before we lock Friday, I want to flag something.")
- question: ask an open question back to the group, or ask the reason for a decision
- clarify: ask the person who addressed ME (by name) to repeat or clarify
- agree: confirm/accept an ask assigned to ME, or agree with a proposal
Rules: first person, natural spoken language, polite but firm, <=${MAX_WORDS} words, no emojis, no quotes, no stage directions. Use people's names from the transcript. Write in the SAME LANGUAGE as the conversation (e.g. Turkish if they speak Turkish). Never invent facts ME did not know; ME only gets to re-enter, not to take a position ME did not choose — objections should flag, not argue specifics.
Prefer moves grounded in the OPEN LEDGER (open decisions, objections, questions, asks assigned to ME) and the last minute of transcript.
If an INTENT is given, all options must be of that kind (varied phrasing/targets).
If a CUSTOM line is given, return exactly ONE option (kind "custom"): ME's text polished into one natural spoken line with the same meaning and language, <=${MAX_WORDS} words.`;

const clipWords = (s: string, n: number) => {
  const w = s.trim().replace(/\s+/g, ' ').split(' ');
  return w.length > n ? w.slice(0, n).join(' ').replace(/[,;:]$/, '') + '.' : s.trim().replace(/\s+/g, ' ');
};
const short = (s: string, n = 6) => {
  const t = clipWords(s, n).replace(/[.?!…]+$/, '');
  return /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]/.test(t) && !/^I\b/.test(t) ? t[0].toLocaleLowerCase() + t.slice(1) : t; // mid-sentence
};

function cleanOptions(raw: unknown, intent?: InterjectIntent): InterjectOption[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: InterjectOption[] = [];
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const line = typeof o.line === 'string' ? clipWords(o.line.replace(/^["“']|["”']$/g, ''), MAX_WORDS + 4) : '';
    if (!line || seen.has(line.toLowerCase())) continue;
    seen.add(line.toLowerCase());
    const kind = (KINDS as readonly string[]).includes(String(o.kind)) ? String(o.kind) : (intent ?? 'custom');
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 24) : kind;
    out.push({ label, line, kind });
    if (out.length === 3) break;
  }
  return out;
}

export async function draftInterjections(req: InterjectRequest): Promise<InterjectResponse> {
  const custom = typeof req.custom === 'string' ? req.custom.trim() : undefined;
  const intent: InterjectIntent | undefined = custom ? 'custom' : req.intent && req.intent !== 'custom' ? req.intent : undefined;
  if (!hasAnthropic()) return { options: mockInterject(req, intent, custom) };
  try {
    const all = req.window ?? [];
    const latest = all.reduce((m, i) => Math.max(m, itemEnd(i)), 0);
    const recent = all.filter((i) => itemEnd(i) >= latest - WINDOW_MS);
    const open = (req.ledger ?? []).filter((l) => !l.resolved);
    const ledger = open.length
      ? open.map((l) => `- ${l.kind}${l.speaker ? ` (${l.speaker})` : ''}: ${l.text}${l.reason ? ` [why: ${l.reason}]` : ''}`).join('\n')
      : '(empty)';
    const user = [
      `OPEN LEDGER:\n${ledger}`,
      `LAST MINUTE:\n${formatTimeline(recent, req.speakers ?? {}, req.me)}`,
      intent && intent !== 'custom' ? `INTENT: ${intent}` : '',
      custom ? `CUSTOM (polish this, keep meaning): ${custom}` : '',
    ].filter(Boolean).join('\n\n');
    const out = await callTool<{ options?: unknown }>(FAST_MODEL, SYSTEM, user, interjectTool);
    const options = cleanOptions(out.options, intent);
    if (custom) return { options: options.slice(0, 1).map((o) => ({ ...o, kind: 'custom' })) };
    return { options: options.length ? options : mockInterject(req, intent, custom) };
  } catch (err) {
    console.error('[interject] error:', (err as Error).message);
    return { options: mockInterject(req, intent, custom) };
  }
}

// ---------- deterministic fallback (no API key / error) ----------
function mockInterject(req: InterjectRequest, intent: InterjectIntent | undefined, custom?: string): InterjectOption[] {
  if (custom) {
    const line = clipWords(custom, MAX_WORDS);
    return [{ label: 'Say it', line: /[.?!…]$/.test(line) ? line : `${line}.`, kind: 'custom' }];
  }
  const open = (req.ledger ?? []).filter((l) => !l.resolved);
  const latestOf = (k: LedgerItem['kind']) => [...open].reverse().find((l) => l.kind === k);
  const decision = latestOf('decision') ?? latestOf('instruction_change');
  const question = latestOf('open_question');
  const ask = latestOf('assigned_to_me');
  const utts = (req.window ?? []).filter((i): i is Utterance => isUtt(i) && i.final !== false && !!i.text.trim() && i.speaker !== -2)
    .sort((a, b) => a.tStart - b.tStart);
  const lastUtt = utts[utts.length - 1];
  const addresser = ask?.speaker ?? (lastUtt ? speakerName(lastUtt.speaker, req.speakers ?? {}) : undefined);
  const who = addresser && addresser !== 'Unknown' ? `, ${addresser}` : '';

  const byKind: Record<Exclude<InterjectIntent, 'custom'>, InterjectOption[]> = {
    object: [
      decision
        ? { label: 'Object', line: `Before we lock ${short(decision.text)}, I want to flag something.`, kind: 'object' }
        : { label: 'Object', line: 'Hold on, before we decide, I want to flag something.', kind: 'object' },
      { label: 'Slow down', line: 'Can we pause for a second? I have a concern.', kind: 'object' },
    ],
    question: [
      question
        ? { label: 'Ask back', line: `Can we come back to this: ${short(question.text, 8)}?`, kind: 'question' }
        : decision
          ? { label: 'Why?', line: `What's the main reason for ${short(decision.text)}?`, kind: 'question' }
          : { label: 'Ask', line: 'Sorry, what did we decide just now?', kind: 'question' },
      { label: 'Ask', line: 'Can someone sum up where we landed?', kind: 'question' },
    ],
    clarify: [
      { label: 'Repeat?', line: `Could you repeat that${who}?`, kind: 'clarify' },
      { label: 'Clarify', line: `Sorry${who}, can you say that again a bit slower?`, kind: 'clarify' },
    ],
    agree: [
      ask
        ? { label: "I'll take it", line: `Yes, I can take ${short(ask.text).replace(/^(can|could|will) you\s+/i, '')}.`, kind: 'agree' }
        : { label: 'Agree', line: 'Sounds good to me, I agree.', kind: 'agree' },
      { label: 'Agree', line: 'Yes, that works for me.', kind: 'agree' },
    ],
  };
  if (intent && intent !== 'custom') return byKind[intent].slice(0, 3);
  // Mixed: pick the three most relevant moves given the ledger.
  const order: Exclude<InterjectIntent, 'custom'>[] = ask ? ['agree', 'clarify', 'object'] : decision ? ['object', 'question', 'clarify'] : ['clarify', 'question', 'object'];
  return order.map((k) => byKind[k][0]);
}
