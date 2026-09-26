// Fast decision gate ("System One"): every FINAL line from someone other than ME -> POST /api/gate
// (~0.7 s Haiku verdict). Upgrades the regex nudge (indirect asks) and drops a PROVISIONAL ledger
// card seconds before the 8 s /api/state loop replaces it with the full ledger.
import { useCallback, useRef, useState, type Dispatch } from 'react';
import type { GateRequest, GateResponse, LedgerKind, Tone, Utterance } from '../../../shared/types';
import { isUtt, speakerName, ME_SPEAKER, type SessionAction, type SessionState } from './session';

export const GATE_ADDRESSED_P = 0.6;
export const GATE_KIND_P = 0.6;
const MAX_INFLIGHT = 2;
const RECENT_N = 6;
const CLIP_WORDS = 14;

export interface LastGate { uttId: string; text: string; res: GateResponse; at: number }

interface Opts {
  getSession: () => SessionState;
  dispatch: Dispatch<SessionAction>;
  /** Mark the line addressedToMe + fire the For-you nudge (deduped by utterance id upstream). */
  nudge: (utt: Utterance, speaker: string) => void;
  /** max tStart already covered by a /api/state response (provisionals at/before it are pointless). */
  coveredT: { current: number };
}

const clip = (t: string, n = CLIP_WORDS) => {
  const w = t.trim().split(/\s+/);
  return w.length > n ? `${w.slice(0, n).join(' ')}…` : t.trim();
};

/**
 * Per-speaker tone hysteresis: the DISPLAYED tone only changes when the new raw tone repeats (2 of that speaker's last
 * 3 lines) or is 'urgent'; otherwise the speaker's previous displayed tone stays. One misread line no longer flips
 * a speaker from "teasing" to "annoyed" and back. Mirrored in tools/fake-phones.mjs (--tone-report).
 */
export function smoothTone(hist: Tone[], shown: Tone | undefined, raw: Tone): { hist: Tone[]; shown: Tone | undefined } {
  const h = [...hist, raw].slice(-3);
  const next = raw === 'urgent' || h.filter((t) => t === raw).length >= 2 ? raw : shown;
  return { hist: h, shown: next };
}

async function postGate(req: GateRequest, signal: AbortSignal): Promise<GateResponse> {
  const res = await fetch('/api/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal });
  if (!res.ok) throw new Error(`/api/gate ${res.status}`);
  return res.json() as Promise<GateResponse>;
}

export function useGate({ getSession, dispatch, nudge, coveredT }: Opts) {
  const [gateLatencyMs, setGateLatencyMs] = useState<number | undefined>(undefined);
  const [lastGate, setLastGate] = useState<LastGate | null>(null);
  const inflight = useRef<{ id: string; ac: AbortController }[]>([]);
  const seen = useRef(new Set<string>());
  const tones = useRef(new Map<number, { hist: Tone[]; shown: Tone | undefined }>());

  const gateUtterance = useCallback((utt: Utterance) => {
    const s = getSession();
    const name = speakerName(s, utt.speaker);
    if (!utt.final || !utt.text.trim() || utt.speaker === ME_SPEAKER) return;
    if (s.me.name && name.trim().toLowerCase() === s.me.name.trim().toLowerCase()) return;
    if (seen.current.has(utt.id)) return;
    seen.current.add(utt.id);

    // Max 2 in flight: a 3rd line aborts the oldest (its verdict is stale; the regex already ran on it).
    while (inflight.current.length >= MAX_INFLIGHT) inflight.current.shift()?.ac.abort();
    const ac = new AbortController();
    const slot = { id: utt.id, ac };
    inflight.current.push(slot);

    const recent = s.timeline.filter((i) => isUtt(i) && i.final && i.id !== utt.id).slice(-RECENT_N);
    const t0 = performance.now();
    postGate({ me: s.me, speakers: s.speakers, recent, target: utt }, ac.signal)
      .then((res) => {
        const ms = Math.round(performance.now() - t0);
        setGateLatencyMs(ms);
        setLastGate({ uttId: utt.id, text: utt.text, res, at: Date.now() });
        const cur = getSession();
        if (res.tone) {
          const prev = tones.current.get(utt.speaker) ?? { hist: [], shown: undefined };
          const next = smoothTone(prev.hist, prev.shown, res.tone);
          tones.current.set(utt.speaker, next);
          dispatch({ type: 'setTone', id: utt.id, tone: next.shown === 'neutral' ? undefined : next.shown, raw: res.tone });
        }
        if (cur.me.name && res.addressed_to_me >= GATE_ADDRESSED_P) nudge(utt, name);
        if (res.kind !== 'chatter' && res.kind_p >= GATE_KIND_P && utt.tStart > coveredT.current) {
          dispatch({
            type: 'addProvisional',
            item: { id: `prov-${utt.id}`, kind: res.kind as LedgerKind, text: clip(utt.text), speaker: name, t: utt.tStart, provisional: true },
          });
        }
      })
      .catch(() => { /* aborted or offline: regex + /api/state still cover it */ })
      .finally(() => { inflight.current = inflight.current.filter((x) => x !== slot); });
  }, [getSession, dispatch, nudge, coveredT]);

  return { gateUtterance, gateLatencyMs, lastGate };
}
