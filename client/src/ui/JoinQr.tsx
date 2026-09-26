// "Add phones" modal: QR + link for participants' phones, and who's connected right now.
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
  /** Host's name, carried in the link so the join page can say "Bera sees your name". */
  hostName?: string;
  /** "The clerk speaks for me": phones speak the listener's lines (voice=1) in this voice. */
  clerkSpeaks?: boolean;
  clerkVoice?: string;
}

/** Prefer the origin this page was actually served from (tunnel / LAN) over the server's guess. */
function joinUrlFor(info: RoomInfo, hostName?: string, clerkSpeaks = false, clerkVoice = ''): string {
  const local = /^(localhost|127\.|\[?::1\]?)/.test(location.hostname);
  const base = local ? info.joinUrl : `${location.origin}/join.html?token=${encodeURIComponent(info.token)}`;
  const q = new URLSearchParams();
  const host = hostName?.trim();
  if (host) q.set('host', host);
  q.set('voice', clerkSpeaks ? '1' : '0');
  if (clerkSpeaks && clerkVoice) q.set('clerkVoice', clerkVoice);
  return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}`;
}

export function JoinQr({ participants, colorOf, onClose, phonesOnly = false, phonesOnlyPref = null, onPhonesOnly, table, hostName, clerkSpeaks = false, clerkVoice = '' }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let dead = false;
    fetch('/api/room')
      .then((r) => (r.ok ? (r.json() as Promise<RoomInfo>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((info) => { if (!dead) setUrl(joinUrlFor(info, hostName, clerkSpeaks, clerkVoice)); })
      .catch((e: unknown) => { if (!dead) setErr(String((e as Error)?.message ?? e)); });
    return () => { dead = true; };
  }, [hostName, clerkSpeaks, clerkVoice]);

  useEffect(() => {
    if (!url || !canvas.current) return;
    QRCode.toCanvas(canvas.current, url, { width: 240, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .catch((e: unknown) => setErr(String((e as Error)?.message ?? e)));
  }, [url]);

  const insecure = url?.startsWith('http://') && !/\/\/(localhost|127\.)/.test(url);

  return (
    <Modal title="Add phones" onClose={onClose}>
      <p className="text-body text-ink">Everyone scans this and puts their phone on the table. Their phone is their mic.</p>
      {err && <p role="alert" className="mt-3 text-warn">Couldn’t load the table link: {err}</p>}
      {url && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <canvas ref={canvas} className="rounded-xl border border-line bg-white" aria-label="QR code for the join link" />
          <div className="w-full break-all text-center font-mono text-[0.78rem] text-muted" data-testid="join-url">{url}</div>
          <button type="button" className="h-14 w-full cursor-pointer rounded-xl border border-line-strong font-bold text-ink"
            onClick={() => { void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {insecure && <p className="text-[0.9rem] text-warn">Phones only allow the mic on https. Run <code>bin/tunnel.sh</code> and open this app from the tunnel URL.</p>}
        </div>
      )}
      <h3 className="mt-7 mb-2 font-mono text-[0.72rem] font-bold tracking-[0.12em] text-muted uppercase">On the table · {participants.length}</h3>
      {participants.length === 0 ? (
        <p className="text-muted">Nobody yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line" data-testid="participants">
          {participants.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: colorOf(p.id) }} />
              <span className="flex-1 font-bold">{p.name}</span>
              <span className="font-mono text-[0.8rem] text-muted">{p.speaking ? 'talking' : 'quiet'}</span>
            </li>
          ))}
        </ul>
      )}
      {participants.length > 0 && table?.overlap && (
        <p className="mt-3 font-bold text-warn" data-testid="table-pace" role="status">Two people are talking at once.</p>
      )}
      {onPhonesOnly && (
        <label className="mt-6 flex cursor-pointer items-start gap-3" data-testid="phones-only">
          <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--ink)]"
            checked={phonesOnlyPref ?? true} onChange={(e) => onPhonesOnly(e.target.checked)} />
          <span>
            <span className="block font-bold">Use phones only</span>
            <span className="block text-[0.9rem] text-muted">
              {participants.length > 0 && phonesOnly ? 'This phone’s mic is muted; lines come from the table.' : 'Mutes this phone’s mic once someone joins, so no line shows twice.'}
            </span>
          </span>
        </label>
      )}
    </Modal>
  );
}
