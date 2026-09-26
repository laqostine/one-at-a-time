# 09 — Which group and which moment? An honest scale check

Date: 2026-09-26. This was a 35-minute research sprint.

**Question:** Our build has live diarized captions, per-phone named mics, a ledger of decisions, questions and asks, a pace and overlap lamp on the hearing people's phones, a text-first "say it for me", and look-away detection. For which Deaf or hard-of-hearing (DHH) group, and in which moment, does it change daily life for the most people? How many people is that, honestly?

**Short answer:** The group is **hard-of-hearing adults at the hearing family table.** The unit is the person, not the diagnosis: a hearing family, three or more voices, crosstalk, and phones already on the table. It is the largest group where our specific features (named mics, the overlap lamp, "asked you" cards) matter. It is also the #1 situation in both our own data and the Italian survey data. Team meetings are a close second. They are the better *demo*, but the population is smaller.

---

## 1. Population numbers (sourced)

| Population | Number | Source / note |
|---|---|---|
| **World**, any hearing loss | >1.5 billion | WHO fact sheet [1]. Includes mild loss. **Do not quote on stage.** |
| **World**, disabling loss (>35 dB in the better ear) | 430 million (34M of them children). Projected >700M by 2050 | WHO [1]. This is mostly *hard of hearing*, not "deaf". |
| **WHO European Region** (53 countries, incl. TR), any loss | ~190 million (≈20%). Projected ~236M by 2050 | WHO World Report on Hearing 2021 [2] |
| **EU27 + UK + NO + CH**, self-reported hearing loss | **59 million = 11.1%** of the population. Among people 65+, **20.7%** | AEA/EFHOH/EHIMA "Getting the numbers right" 2024, EuroTrak 2021-23 [3] |
| **EU27 only** (derived) | **≈50 million** | [3] minus UK (~7.4M), NO and CH (~1.2M). This is our arithmetic, so say "about 50 million". |
| Hearing-aid uptake among people who self-report loss | **36%** (Europe average across 30 countries). 58% drop out between noticing the loss and getting an aid | [3] |
| **Italy**, self-reported loss | **12.5%** of the population (≈7.4M). By age: 18+ 14.4%; 55-64 13.6%; 65-74 22.4%; **75+ 38.3%**. Hearing-aid adoption **35.2%** (4.4% of the whole population) | EuroTrak Italy 2022 [4]. Italy has the EU's oldest population (23.8% are 65+) [3]. |
| Italy, age split (derived) | ≈4.3M aged 65+ and ≈2.9M aged 25-64 | Our calculation: the [4] age curve applied to ISTAT age bands. It is approximate. |
| Italy, "where is it most important to hear well?" (people with hearing loss, n=1,317) | **At home with family members 56%**, on the phone 47%, TV with others 45%, 1:1 38%, small groups 34%, **large groups 28%**, noisy situations 28%, **workplace 21%**, **school 5%** | [4], page 60 |
| Italy, hearing-aid owners' satisfaction by situation | 1:1 conversation 84% satisfied. **Large groups 77%** (12% dissatisfied). Noisy situations 73%. So group and noisy talk stays the weakest spot even *with* aids. | [4], page 58 |
| Italy, hearing-aid app use | 26% of aid owners use a hearing-aid app | [4] |
| Italy, internet use by age | Ages 65-74: 60.4%. **Ages 75+: 24.7%** | ISTAT "Cittadini e ICT" 2023 [5] |
| EU, internet use by age | Ages 65-74 went from ~20% (2009) to almost 80% (2024) | Eurostat [6] |
| **Türkiye**, hearing loss | **3.4%** of the population (≈2.9M), per the TÜİK Türkiye Sağlık Araştırması 2022 as cited secondarily [7]. Press and industry estimates say 2.2-3 million [8]. Only **179,867** are registered in the national disability data system (Jan 2023) [8][9]. | We could not open the TÜİK primary table in time. Treat it as approximate. |
| Deaf **sign-language users**, EU | ~0.5 million (1 in 1,000) to ~1 million | European Parliament EPRS 2018 [10]; EPP/EUD [11] |
| DHH children with hearing parents | **>90%** (US data) | Mitchell & Karchmer 2004 [12]. The popular "96%" figure is looser. Use ">90%". |
| Cochlear implant recipients, worldwide | ~736,000+ | industry/NIDCD-derived figure [13]. Treat it as an order of magnitude. |
| Deafblind (severe vision + hearing loss) | Italy 100k; Europe 656k | ISTAT / Lega del Filo d'Oro 2023 [14] |
| Late-deafened adults (onset 18-50) | **No reliable EU count found.** Sudden sensorineural loss runs at ~5-27 per 100k per year, which would be tens of thousands a year in the EU. Most cases are one-sided, and many recover. | AAO-HNS 2019 guideline (from memory, unverified in this sprint) |
| DHH students in EU higher education | **Not found.** Italy's "school/classroom" situation mattered to only 5% of people with hearing loss [4]. | — |

**Why moments matter for health and money:**
- Untreated hearing loss is linked to **46% higher health-care costs over 10 years** and a **44% higher risk of 30-day hospital readmission** (Reed et al., JAMA Otolaryngology 2019) [15].
- In one qualitative study, 60% of older patients with hearing loss reported mishearing diagnosis or medication information [16].
- In Italy, 23-35% of people with hearing loss agree that untreated loss means being "less promoted" or not getting "the job they deserve" [4].
- Hearing loss is the largest single *modifiable* risk factor for dementia (Lancet Commission 2024, about 7% of cases). Say "risk factor", never "cause".

**The big structural fact:**
- Roughly **40-57%** of Europeans who self-report hearing loss are 65+. That means ~40-60% are of **working age**. The "it's just grandparents" framing is wrong.
- But the densest pocket (Italy 75+: 38% prevalence) is also where only **25% use the internet**.

---

## 2. Our own evidence: keyword-line counts in our Reddit corpora

| Moment | `reddit/threads.md` | `reddit/wishlist.md` | Other internal evidence |
|---|---|---|---|
| Family / dinner / holidays | **52** | 2 | NLM pain #1 "Dinner Table Syndrome"; persona 19:30 (08); Meek 2020 [17] |
| Work / meetings | 42 | **43** | N2 "nodding along… no idea what was decided" is the top-scored need (07) |
| Class / lecture / university | 13 | 26 | N6 (07) |
| Games / Discord | 0 | 18 | N5; CaptionsRush exists |
| Restaurant / bar / party | 7 | 7 | book-club-in-a-bar thread (07 N1) |
| Parents / grandparents / older relatives | 7 | 4 | — |
| Parent-teacher / own children | 5 | 0 | — |
| Doctor / pharmacy / hospital | 2 | 3 | — |
| Bank / counter / government | 2 | 3 | — |
| Church / religious | 2 | 0 | — |

Caveats:
- These are line counts from keyword regexes, not people.
- The `threads.md` search seeds ("group conversation", "joke everyone laughed") tilt it toward social and family moments. The `wishlist.md` seeds tilt it toward apps and work.
- Reddit skews young and online. **Older adults are nearly invisible in our data.**

---

## 3. Scoring

Each factor is scored 1-5. **Size** is on a log scale for EU+TR: 5 = ≥10M, 4 = 1-10M, 3 = 0.3-1M, 2 = 30-300k, 1 = <30k. The total is the product of the five factors (max 3,125).

| Rank | Group × moment | Size | Severity | Unmet | Phone-on-table feasible | Our evidence | **Score** | One-line reason |
|---|---|---|---|---|---|---|---|---|
| **1** | **(a) HoH adults at hearing family meals (Dinner Table Syndrome)** | 5 (~50M self-reported in the EU, ~2.9M in TR; family meals are near-universal) | 3 (relationships, exhaustion, isolation; not money or safety) | 4 (Live Transcribe is one mic and fails on crosstalk; Ava is paid and needs installs; nothing faces the hearing people) | 4 (phones are already on the table; a QR join removes installs; some families ban phones at meals) | 5 (52 lines, NLM #1, Italy #1 situation at 56%) | **1,200** | Largest group, #1 moment in two independent data sources, and the overlap lamp and named mics are uniquely suited to it |
| **2** | **(b) HoH employees in in-room / hybrid team meetings** | 3-4 (derived: ~20M EU aged 25-64 with self-reported loss → ~14M employed → **roughly 5-7M in meeting-heavy jobs**) | 5 (promotion, pay, "nodding along" to decisions) | 3 (Teams/Zoom captions cover online meetings; the in-room and hybrid table is the gap) | 5 (laptops and phones in meetings are normal) | 5 (43 lines, top-scored need N2) | **1,125** (with size 3) | Best fit for the ledger, and the best stage demo. Smaller group than (a), and competitors are closer. |
| **3** | (k) HoH adults at restaurants / bars / friends' evenings | 5 (same pool as a) | 3 | 4 (noise defeats single-phone apps; per-phone mics are the community's own fix) | 3 (noise; friends must opt in) | 4 | **720** | Same product as (a) in a harder acoustic setting. Good as the demo's "noise" beat. |
| 4 | (e) Late-deafened adults, first 2 years | 2 | 5 | 4 | 5 | 2 | 400 | Intense need, but small and uncounted |
| 5 | (f) HoH patients at doctor / pharmacy | 4 | 5 (safety, money: +46% costs, +44% readmissions [15]) | 3 (1:1 in a quiet room is where Live Transcribe *already works*; the unmet part is a "what do I do now" card) | 3 (consent, GDPR, doctors' time, medical-term ASR errors) | 1-2 (2-3 lines) | 180-360 | Strongest severity, but weakest fit for *our* multi-speaker features. Future "medical mode". |
| 6 | (d) Adults 65+ with untreated loss at family gatherings | 5 (~23M 65+ with self-reported loss in the EU+UK+NO+CH; ~64% have no aid) | 4 | 4 | 2 (Italy 75+: 25% internet; "I hear enough" denial [4]; vision and reading speed) | 1 (invisible on Reddit) | **160** | Biggest raw number, but a phone app built tonight will not reach them unless *the family* runs it |
| 7 | (c) HoH students in group projects / seminars | 2 | 4 | 2 (CART, Verbit, disability offices) | 5 | 4 | 320 | Served best by existing university services |
| 8 | (g) HoH parents at parent-teacher meetings | 2 | 3 | 4 | 4 | 2 | 192 | Plausible, but thin evidence |
| 9 | (h) Government / bank counters | 4 | 4 | 3 | 2 (behind glass; the clerk won't scan a QR) | 1 | 96 | The counter is the wrong form factor for a per-phone design |
| 10 | (i) Deaf gamers | 2 | 2 | 2 (CaptionsRush, Discord bots) | 2 (needs desktop audio) | 4 | 64 | Loud on Reddit, small, already being built |
| 11 | (j) Religious / community meetings | 3 | 2 | 3 (telecoil loops exist; Italy aid owners use telecoil "in church" [4]) | 2 (phones at a service are inappropriate) | 1 | 36 | — |

Scores (a) and (b) are within noise of each other. The tie-breakers are size, where (a) wins by roughly an order of magnitude, and the Italian survey, where "at home with family" scores 56% against 21% for "workplace".

---

## 4. Verdict

**Name on stage: "Hard-of-hearing people at the family table."** Keep work meetings as the second example, not the headline.

**The defensible population line:**
> "In the EU, about 50 million people say they have trouble hearing, which is one in nine. Only about a third use hearing aids. And when you ask them where they most want to hear, the answer isn't the office. It's at home, with their family." (Sources: [3]; Italy 56% [4].)

Italian variant for Milan:
> "In Italy, 1 in 8 people report hearing loss, and more than 1 in 3 people over 75. Even with hearing aids, groups and noise are where satisfaction drops." [4]

**Honest estimate of how many people would be *materially* helped:**

| Layer | Estimate | How we got it |
|---|---|---|
| **Addressable** | **~10 million people in the EU** (order of magnitude) | ~50M self-reported, cut to those with moderate-or-worse difficulty following groups (WHO's disabling/any ratio is ~29%, so roughly 15M), cut again to those under ~75 who use a smartphone |
| **Realistic reach** if a free, zero-install web app spread well | **Hundreds of thousands**, not millions | Ava and Group Transcribe show that multi-phone captioning stays niche, because the *hearing* family has to join every time |
| **Tonight** | Tens of people | — |

Say "helps a group of *millions*" only in the sense of the problem size. Never say "we will help millions".

**Two changes to the current build so it fits the family table:**

1. **Italian and Turkish, end to end.**
   - This covers the ASR language setting, the ledger labels and the "say it for me" TTS voice.
   - Family tables code-switch (Nonna in dialect, kids in English), so show language per line.
   - Verify that our Deepgram model and region support `it` and `tr` for streaming before the demo.
   - Without this, the Milan and Türkiye numbers above are rhetorical.

2. **"Table mode": bigger, calmer, and family-worded.**
   - One shared screen stands in the middle of the table (a laptop or tablet), in addition to personal phones.
   - Use ≥28px type and one card at a time, with no scrolling wall. This also works for the 65+ relatives who won't read a phone.
   - Rename the ledger from Decisions / Questions / Asks to **"Asked you" / "Plans" / "Why they laughed"**.
   - The overlap lamp is the default view on the hearing relatives' phones.
   - The killer line becomes: "Mamma asked you: are you coming Sunday?"

A later option, not tonight: a **"medical mode"** (1:1, a "what to do / medicines / next appointment" card, explicit consent banner, no cloud storage). This is where severity and money are, but it needs privacy work.

---

## 5. Claims we should NOT make

- **"430 million deaf people"** is wrong. The WHO figure is *disabling hearing loss*, and most of those people are hard of hearing, not deaf. "1.5 billion" includes mild loss.
- **"59 million in the EU"** is wrong. That figure covers EU27 + UK + Norway + Switzerland. Say "about 50 million in the EU" or "59 million in Europe".
- **"We will help millions."** The honest realistic reach is hundreds of thousands, if adoption goes well.
- **"96% of deaf children have hearing parents"** as a European fact. It is US data, and the defensible figure is ">90%". It is also about children, who are not our primary user.
- **"For the Deaf community"** as the main framing. Sign-language users (~0.5-1M in the EU) often prefer interpreters or sign, and a voice or text app mostly serves **hard-of-hearing** people. Say "Deaf and hard-of-hearing", and lead with hard of hearing.
- **"Hearing loss causes dementia."** Say "the largest modifiable risk factor" [Lancet 2024].
- **Türkiye "3 million"** is a press estimate. The TÜİK 3.4% figure is a secondary citation, and the official registry lists only ~180k. Say "around 3% of Türkiye reports hearing loss".
- **Reddit counts as prevalence.** They are keyword lines from seeded searches.
- **"Older adults will use this."** Italian 75+ internet use is 25%. Only claim it if *the family* runs the app.

---

## Sources

1. WHO, Deafness and hearing loss fact sheet: https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss
2. WHO World Report on Hearing 2021 (European Region ~190M): https://www.efhoh.org/wp-content/uploads/2021/03/World-Hearing-Report.pdf ; https://www.hearinghealth.eu/
3. AEA/EFHOH/EHIMA, *Getting the numbers right on Hearing Loss, Hearing Care and Hearing Aid Use in Europe*, March 2024: https://www.ehima.com/wp-content/uploads/2024/03/Getting-the-numbers-right-on-Hearing-Loss-Hearing-Care-and-Hearing-Aid-Use-in-Europe-2024.pdf
4. EHIMA/Anovum, EuroTrak Italy 2022 (n=15,210): https://www.ehima.com/wp-content/uploads/2022/11/EuroTrak_Italy_2022.pdf
5. ISTAT, Cittadini e ICT 2023: https://www.istat.it/it/files/2023/12/Cittadini-e-ICT-2023.pdf
6. Eurostat, People online in 2024 / internet use by age: https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20241217-1 ; https://www.researchgate.net/figure/nternet-use-in-the-European-Union-from-2009-to-2024-by-age-group-Source-authors-work_fig2_397253838
7. Secondary citation of TÜİK Türkiye Sağlık Araştırması 2022 (3.4%): https://dergipark.org.tr/tr/download/article-file/2156000 (search snippet; primary: https://data.tuik.gov.tr/Kategori/GetKategori?p=saglik-ve-sosyal-koruma-101&dil=1)
8. Sözcü, "Türkiye'de 2,2 milyon kişi işitme engelli": https://www.sozcu.com.tr/turkiyede-22-milyon-kisi-isitme-engelli-wp6984252 ; Engelli.com 2023: https://www.engelli.com/turkiyede-engelli-sayisi/
9. T.C. Aile ve Sosyal Hizmetler Bakanlığı, EYHGM İstatistik Bülteni (Nisan 2023): https://aile.gov.tr/media/135432/eyhgm_istatistik_bulteni_nisan_23.pdf
10. European Parliament EPRS, Sign languages in the EU (2018): https://www.europarl.europa.eu/RegData/etudes/ATAG/2018/625196/EPRS_ATA(2018)625196_EN.pdf
11. EPP Group, Deaf and hard-of-hearing: https://eppgroup.eu/newsroom/news/deaf-and-hard-of-hearing-eu-institutions-easing
12. Mitchell & Karchmer (2004), *Sign Language Studies* 4(2): https://eric.ed.gov/?id=EJ747626
13. Cochlear implant recipients (~736k): https://int.livhospital.com/how-many-people-have-cochlear-implants-success/ (secondary; NIDCD-derived)
14. ISTAT / Lega del Filo d'Oro, sordocecità 2023: https://www.legadelfilodoro.it/it/presentato-studio-istat-sordocecita
15. Reed et al., JAMA Otolaryngology 2019: https://pubmed.ncbi.nlm.nih.gov/30419131/
16. Patient-provider communication and age-related hearing loss (qualitative): https://pmc.ncbi.nlm.nih.gov/articles/PMC10808372/ ; Shukla et al. 2019 systematic review: https://doi.org/10.1177/1062860618798926
17. Meek (2020), Dinner Table Syndrome, *The Qualitative Report* 25(6): https://nsuworks.nova.edu/tqr/vol25/iss6/16/
18. Livingston et al., Dementia prevention, intervention and care: 2024 report of the Lancet standing Commission (hearing loss ≈7% PAF). Cited from knowledge and not re-fetched in this sprint.
- Internal: `research/07-reddit-wishlist-analysis.md`, `research/04-final-synthesis.md`, `research/08-a-thursday-as-deniz.md`, `research/reddit/threads.md`, `research/reddit/wishlist.md` (the keyword counts above).
