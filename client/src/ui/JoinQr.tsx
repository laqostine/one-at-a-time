// "Everyone joins" modal: QR + link for participants' phones, and who's connected right now.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Participant, RoomInfo } from '../../../shared/types';
import { Modal } from './Modal';
import { Button } from '@/components/ui/button';

interface Props {
  participants: Participant[];
  colorOf: (id: number) => string;
  onClose: () => void;
  /** effective: this device's mic is muted because phones are joined */
  phonesOnly?: boolean;
  /** null = user hasn't chosen (defaults ON once a phone joins) */
  phonesOnlyPref?: boolean | null;
  onPhonesOnly?: (v: boolean) => void;
  table?: { overlap: boolean; avgWpm: number } | null;
  /** Host's name, carried in the link so the join page can say "Bera sees your name". */
  hostName?: string;
}

/** Prefer the origin this page was actually served from (tunnel / LAN) over the server's guess. */
function joinUrlFor(info: RoomInfo, hostName?: string): string {
  const local = /^(localhost|127\.|\[?::1\]?)/.test(location.hostname);
  const base = local ? info.joinUrl : `${location.origin}/join.html?token=${encodeURIComponent(info.token)}`;
  const host = hostName?.trim();
  return host ? `${base}${base.includes('?') ? '&' : '?'}host=${encodeURIComponent(host)}` : base;
}

export function JoinQr({ participants, colorOf, onClose, phonesOnly = false, phonesOnlyPref = null, onPhonesOnly, table, hostName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let dead = false;
    fetch('/api/room')
      .then((r) => (r.ok ? (r.json() as Promise<RoomInfo>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((info) => { if (!dead) setUrl(joinUrlFor(info, hostName)); })
      .catch((e: unknown) => { if (!dead) setErr(String((e as Error)?.message ?? e)); });
    return () => { dead = true; };
  }, [hostName]);

  useEffect(() => {
    if (!url || !canvas.current) return;
    QRCode.toCanvas(canvas.current, url, { width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .catch((e: unknown) => setErr(String((e as Error)?.message ?? e)));
  }, [url]);

  const insecure = url?.startsWith('http://') && !/\/\/(localhost|127\.)/.test(url);

  return (
    <Modal title="Everyone joins" onClose={onClose}>
      <p className="text-body text-muted">Each person scans this and talks into their own phone. Captions show their real name — no guessing who spoke.</p>
      {err && <p role="alert" className="mt-3 text-warn">Couldn’t load the table link: {err}</p>}
      {url && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <canvas ref={canvas} className="rounded-2xl bg-white p-1 shadow-[var(--glow-accent)]" aria-label="QR code for the join link" />
          <div className="w-full break-all rounded-xl border border-border bg-card-2 px-3 py-2 text-center font-mono text-[0.8rem] text-muted" data-testid="join-url">{url}</div>
          <Button type="button" variant="secondary" className="w-full text-[1rem]"
            onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          {insecure && <p className="text-sm text-warn">Phones only allow the mic on https. Run <code>bin/tunnel.sh</code> and open this app from the tunnel URL.</p>}
        </div>
      )}
      <h3 className="mt-6 mb-2 card-label">At the table ({participants.length})</h3>
      {participants.length === 0 ? (
        <p className="text-muted">Nobody has joined yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="participants">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card-2 px-3 py-2.5" style={{ borderLeft: `4px solid ${colorOf(p.id)}` }}>
              <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf(p.id) }} />
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${p.speaking ? 'bg-good imt-pulse' : 'bg-line'}`} />
              <span className="w-16 text-right text-sm text-muted">{p.speaking ? 'speaking' : 'quiet'}</span>
            </li>
          ))}
        </ul>
      )}
      {participants.length > 0 && table && (table.avgWpm > 0 || table.overlap) && (
        <p className={`mt-3 text-sm ${table.overlap ? 'font-semibold text-bad' : 'text-muted'}`} data-testid="table-pace" role="status">
          {table.overlap ? 'Two people are talking at once. ' : ''}{table.avgWpm > 0 ? `Table pace ${table.avgWpm} wpm` : ''}
        </p>
      )}
      {onPhonesOnly && (
        <div className="mt-5 rounded-xl border border-border bg-card-2/50 p-3.5" data-testid="phones-only">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
              checked={phonesOnlyPref ?? true} onChange={(e) => onPhonesOnly(e.target.checked)} />
            <span>
              <span className="block font-semibold">Use phones only (mute this device’s mic)</span>
              <span className="block text-sm text-muted">Stops the same line showing up twice when this device also hears the phones.</span>
            </span>
          </label>
          {participants.length > 0 && (
            <p className="mt-2 text-sm" role="status" aria-live="polite">
              {phonesOnly
                ? (phonesOnlyPref == null ? 'A phone joined, so this device’s mic is now muted. Captions come from the phones.' : 'This device’s mic is muted. Captions come from the phones.')
                : 'This device’s mic is on too. Lines heard by both are merged.'}
            </p>
          )}
          {participants.length === 0 && <p className="mt-2 text-sm text-muted">Turns on when the first phone joins.</p>}
        </div>
      )}
    </Modal>
  );
}
