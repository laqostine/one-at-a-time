// "Everyone joins" modal: QR + link for participants' phones, and who's connected right now.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Participant, RoomInfo } from '../../../shared/types';
import { Modal } from './Modal';

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
}

/** Prefer the origin this page was actually served from (tunnel / LAN) over the server's guess. */
function joinUrlFor(info: RoomInfo): string {
  const local = /^(localhost|127\.|\[?::1\]?)/.test(location.hostname);
  if (!local) return `${location.origin}/join.html?token=${encodeURIComponent(info.token)}`;
  return info.joinUrl;
}

export function JoinQr({ participants, colorOf, onClose, phonesOnly = false, phonesOnlyPref = null, onPhonesOnly, table }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let dead = false;
    fetch('/api/room')
      .then((r) => (r.ok ? (r.json() as Promise<RoomInfo>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((info) => { if (!dead) setUrl(joinUrlFor(info)); })
      .catch((e: unknown) => { if (!dead) setErr(String((e as Error)?.message ?? e)); });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!url || !canvas.current) return;
    QRCode.toCanvas(canvas.current, url, { width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .catch((e: unknown) => setErr(String((e as Error)?.message ?? e)));
  }, [url]);

  const insecure = url?.startsWith('http://') && !/\/\/(localhost|127\.)/.test(url);

  return (
    <Modal title="Everyone joins" onClose={onClose}>
      <p className="text-muted">Each person scans this and talks into their own phone. Captions show their real name — no guessing who spoke.</p>
      {err && <p role="alert" className="mt-3 text-warn">Couldn’t load the table link: {err}</p>}
      {url && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <canvas ref={canvas} className="rounded-xl bg-white" aria-label="QR code for the join link" />
          <div className="w-full break-all rounded-xl bg-card-2 px-3 py-2 text-center font-mono text-sm" data-testid="join-url">{url}</div>
          <button type="button" className="h-11 w-full rounded-xl bg-card-2 font-semibold hover:brightness-125"
            onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {insecure && <p className="text-sm text-warn">Phones only allow the mic on https. Run <code>bin/tunnel.sh</code> and open this app from the tunnel URL.</p>}
        </div>
      )}
      <h3 className="mt-5 mb-2 font-semibold">At the table ({participants.length})</h3>
      {participants.length === 0 ? (
        <p className="text-muted">Nobody has joined yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="participants">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl bg-card-2 px-3 py-2">
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
        <div className="mt-5 rounded-xl border border-line p-3" data-testid="phones-only">
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
