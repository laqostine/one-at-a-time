---
marp: true
paginate: false
size: 16:9
title: One at a time — BAINSA 2026
---

<style>
/* One at a time: cream page, ink type, amber the only accent. No icons, no shadows, hairlines only. */
:root { --cream:#F4EEE2; --ink:#17130F; --ink2:#5E554B; --rule:#D9D0C0; --amber:#E4A73A; --go:#4C8C5C; }
section {
  background: var(--cream); color: var(--ink);
  font-family: 'Nunito', 'Helvetica Neue', Arial, sans-serif; font-size: 26px; line-height: 1.4;
  padding: 56px 72px; justify-content: flex-start;
}
h1, h2, .display { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }
h1 { font-size: 150px; line-height: 1; margin: 0; }
h2 { font-size: 50px; line-height: 1.12; margin: 0 0 22px 0; }
.label, .lbl { font-family: 'Space Mono', Consolas, 'Courier New', monospace; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); }
.ink2 { color: var(--ink2); }
.amber { color: var(--amber); }
.rule { border-top: 1px solid var(--rule); }
sup { font-family: 'Space Mono', Consolas, monospace; font-size: .5em; color: var(--ink2); }
strong { font-weight: 700; }

/* 1 title */
section.title { justify-content: center; }
section.title .sub { font-family: Georgia, serif; font-style: italic; font-size: 38px; color: var(--ink2); margin-top: 28px; max-width: 900px; }
section.title .foot { position: absolute; left: 72px; right: 72px; bottom: 56px; border-top: 1px solid var(--rule); padding-top: 16px; display: flex; justify-content: space-between; }

/* 2 flip */
.flip { font-size: 30px; max-width: 1100px; margin-bottom: 26px; }
.flip b { font-family: Georgia, serif; font-style: italic; font-weight: 500; }
.quotes { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; border-top: 1px solid var(--rule); padding-top: 22px; }
.quotes p { font-family: Georgia, serif; font-style: italic; font-size: 23px; line-height: 1.38; margin: 0 0 12px 0; }

/* 3 numbers */
.nums { display: grid; grid-template-columns: 1fr 1fr; column-gap: 56px; row-gap: 0; margin-top: 8px; }
.num { border-top: 1px solid var(--rule); padding: 18px 0 20px 0; }
.num .n { font-family: Georgia, serif; font-style: italic; font-size: 76px; line-height: 1; }
.num .n .amber { color: var(--amber); }
.num .t { font-size: 22px; margin-top: 8px; }

/* 4 phones */
.phones { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 4px; justify-items: center; }
.phones figure { margin: 0; text-align: center; }
.phones img { height: 440px; border: 1px solid var(--rule); border-radius: 12px; display: block; margin: 8px auto 12px auto; }
.phones .cap { font-family: Georgia, serif; font-style: italic; font-size: 30px; }
.phones .lbl { font-size: 13px; }

/* 5 rows */
.five { display: grid; grid-template-columns: 1fr 250px; gap: 56px; }
.row { display: grid; grid-template-columns: 250px 1fr; border-top: 1px solid var(--rule); padding: 13px 0; align-items: baseline; }
.row .lbl { font-size: 15px; color: var(--ink); }
.row .t { font-size: 23px; }
.row .t i { font-family: Georgia, serif; }
.ask { border-top: 1px solid var(--rule); padding-top: 14px; margin-top: 2px; font-family: Georgia, serif; font-style: italic; font-size: 30px; }
.ask .dot { display: inline-block; width: 20px; height: 20px; border-radius: 50%; background: var(--amber); margin-right: 12px; vertical-align: middle; }
.five img { height: 440px; border: 1px solid var(--rule); border-radius: 12px; }

/* 6 table */
table { border-collapse: collapse; width: 100%; font-size: 21px; background: transparent; display: table; }
th, td { border: none; border-top: 1px solid var(--rule); padding: 13px 16px 13px 0; text-align: left; vertical-align: top; background: transparent !important; color: var(--ink); }
th { font-family: 'Space Mono', Consolas, monospace; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); font-weight: 400; }
tr.us td { border-top: 1px solid var(--ink); }
.close { font-family: Georgia, serif; font-style: italic; font-size: 40px; margin-top: 22px; }

/* 7 scope */
.seven { display: grid; grid-template-columns: 1.05fr 1fr; gap: 48px; }
.kv { display: grid; grid-template-columns: 130px 1fr; border-top: 1px solid var(--rule); padding: 9px 0; font-size: 20px; align-items: baseline; }
.kv .lbl { font-size: 13px; }
.src { border-left: 1px solid var(--rule); padding-left: 32px; font-size: 14px; line-height: 1.35; }
.src ol { padding-left: 20px; margin: 10px 0 0 0; }
.src li { margin-bottom: 9px; }
.src a, .src .u { color: var(--ink2); font-family: 'Space Mono', Consolas, monospace; font-size: 11px; word-break: break-all; text-decoration: none; }
</style>

<!-- _class: title -->

<div class="label">BAINSA Hackathon 2026</div>

# One at a time.

<div class="sub">The first accessibility tool for the hearing side of the table.</div>

<div class="foot"><span class="label">Team · [Name] · [Name] · [Name] · [Name]</span><span class="label">Milan · 2026</span></div>

<!--
Presenter hands a judge the listener phone.
"Every accessibility tool puts the burden on the deaf person. We built the other side. Hold this."
Fallback: ?replay=demo2 reproduces the exact same cards without a key or mic.
-->

---

<div class="label">The flip</div>

## Every tool puts the work on the person who can't hear.

<div class="flip">They read faster, ask again, and get told “never mind.” Nobody asks the table to change anything. The people talking never find out they lost someone. <b>We built the tool for the table.</b></div>

<div class="quotes">
<div>
<p>“I've started just nodding along even when I have no idea what was decided. My boss mentioned something about a new client project last Thursday and I smiled and agreed but I genuinely don't know what I signed up for.”</p>
<div class="label">r/deaf · 35↑ <sup>5</sup></div>
</div>
<div>
<p>“DTS - Dinner Table Syndrome. Deaf people in hearing families are too familiar with this, myself included. It's simply too much work to follow along. Thats why you feel like you could sleep for a week, we have to work much harder than a hearing person to understand verbal conversations.”</p>
<div class="label">r/deaf · family Sunday lunch thread, 36↑ <sup>6</sup></div>
</div>
</div>

---

<div class="label">The numbers</div>

## Where they most want to hear is home.

<div class="nums">
<div class="num"><div class="n">50M</div><div class="t">people in the EU report trouble hearing. About <strong>1 in 9</strong>.<sup>1</sup></div></div>
<div class="num"><div class="n"><span class="amber">56%</span> <span class="ink2" style="font-size:44px">vs 21%</span></div><div class="t">The <strong>family table</strong> is the #1 place they want to hear. Work: 21%. EuroTrak Italy 2022.<sup>2</sup></div></div>
<div class="num"><div class="n">170 <span class="ink2" style="font-size:44px">wpm</span></div><div class="t">Caption comprehension collapses above it. Group speech runs <strong>160–220</strong>.<sup>3</sup></div></div>
<div class="num"><div class="n">4%</div><div class="t">of sampled videos caption non-speech sound: the laugh, the tone.<sup>4</sup></div></div>
</div>

<div class="label" style="margin-top:14px">Hard-of-hearing and late-deafened adults · EU27 figure derived from the 59M Europe total · sources on the last slide</div>

---

<div class="label">The table</div>

<div class="phones">
<figure>
<div class="lbl">Lamp · Go ahead / One at a time</div>
<img src="build/assets/oat-lamp.png">
<div class="cap">their phone</div>
</figure>
<figure>
<div class="lbl">Listener · one sentence · Mom · teasing</div>
<img src="build/assets/oat-listener.png">
<div class="cap">your phone</div>
</figure>
<figure>
<div class="lbl">Map · who, to whom, about what</div>
<img src="build/assets/oat-map.png">
<div class="cap">where it went</div>
</figure>
</div>

---

<div class="label">What the listener gets back</div>

<div class="five">
<div>

## One sentence, and what a voice carries.

<div class="row"><span class="lbl">Who</span><span class="t">Every line named. The phones are the mics.</span></div>
<div class="row"><span class="lbl">How it was said</span><span class="t">Tone in 0.7 s: <i>warm, teasing, annoyed.</i></span></div>
<div class="row"><span class="lbl">What was agreed</span><span class="t">Plans with the reason, refreshed every 10 s.</span></div>
<div class="row"><span class="lbl">When they laughed</span><span class="t">“The table laughed.” No audio model.</span></div>
<div class="ask"><span class="dot"></span>Your name is called: the whole phone turns amber in under 1 s.</div>

</div>
<div><img src="build/assets/oat-listener-asked.png"></div>
</div>

---

<div class="label">What's new, honestly</div>

## Everyone else builds for the listener.

<table>
<tr><th>Tool</th><th>Already does</th><th>Doesn't do</th></tr>
<tr><td><strong>Ava</strong></td><td>Phones as named mics, for captions</td><td>Never sends pace or overlap back to the speakers' own phones</td></tr>
<tr><td><strong>Otter / Zoom</strong></td><td>Summarize the conversation</td><td>Only after it's over</td></tr>
<tr><td><strong>Caption glasses</strong></td><td>Words in front of the listener's eyes</td><td>Put more on the deaf person, nothing the table can act on</td></tr>
<tr class="us"><td><strong>One at a time</strong></td><td>Phones as mics, like Ava</td><td>Amber on the talkers' phones. One sentence, one tap, back to the table.</td></tr>
</table>

<div class="close">Ava does the mics. <span class="amber">We do the other side of the table.</span></div>

---

<div class="label">Scope · limits · next</div>

<div class="seven">
<div>

## What this is, and isn't.

<div class="kv"><span class="lbl">For</span><span>Hard-of-hearing and late-deafened adults in hearing rooms.</span></div>
<div class="kv"><span class="lbl">Not for</span><span>Sign-first Deaf users.</span></div>
<div class="kv"><span class="lbl">Tested</span><span>Not yet tested with a hard-of-hearing user.</span></div>
<div class="kv"><span class="lbl">Reach</span><span>~10M in the EU could use it. Tonight it reaches a table.</span></div>
<div class="kv"><span class="lbl">Languages</span><span>Italian and Turkish verified, plus English.</span></div>
<div class="kv"><span class="lbl">Next</span><span>User tests with hard-of-hearing people. A real voice on the phones (ElevenLabs slot). Look-away catch-up is already built.</span></div>

</div>
<div class="src">
<div class="label">Sources</div>
<ol>
<li>AEA / EFHOH / EHIMA, <i>Getting the numbers right on hearing loss in Europe</i>, 2024. 59M Europe; EU27 ≈50M is our arithmetic.<br><span class="u">ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf</span></li>
<li>EHIMA / Anovum, <i>EuroTrak Italy 2022</i>, p. 60.<br><span class="u">ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf</span></li>
<li>Caption reading speed vs. conversational pace: synthesis of captioning-speed studies (research/05-numbers-for-pitch.md); not a single primary source.</li>
<li>Non-speech information in captions, PMC7040021; May et al., 2025.<br><span class="u">pmc.ncbi.nlm.nih.gov/articles/PMC7040021/</span></li>
<li>r/deaf, “Anyone else struggling with group conversations at work…” (35↑).<br><span class="u">reddit.com/r/deaf/comments/1r2797f/</span></li>
<li>r/deaf, “Exhausted and sad after family Sunday lunch” (36↑).<br><span class="u">reddit.com/r/deaf/comments/1fh8h7h/</span></li>
</ol>
</div>
</div>
