Answer:
### **1. Meeting AI Assistants & In-Meeting Question Engines**
* **Name:** **Zoom AI Features** (In-Meeting Questions & Meeting Summaries) / 
**AI Meeting Assistants** (e.g., Otter, TruthBytes analysis) [1-3].
* **What it does:** Uses Automatic Speech Recognition (ASR) to generate 
post-meeting summaries, action items, and searchable transcripts [3, 4]. During 
live sessions, features like Zoom's **Meeting Questions** allow participants to 
discreetly ask AI queries about what was discussed (e.g., *"What did I miss?"* 
or *"When is the deadline?"*), delivering contextual answers with timestamped 
transcript citations [2, 5].
* **Main gap:** Summaries compress meeting history post-hoc and omit 
intermediate disagreements, live objections, or unstated nuances [6-8]. They 
serve as memory aids after decisions are made rather than providing real-time 
access while a decision is actively forming [7, 9]. Additionally, in-meeting AI 
Q&A relies entirely on underlying ASR accuracy and text interaction [2, 4, 9].

---

### **2. Augmented Reality (AR) Smart Glasses & Wearable Displays**
* **Name:** **AR Smart Glasses & Wearable Subtitles** (e.g., **ARRAE Platform** 
by Mathew et al., **Wearable Subtitles** by Olwal et al., Miller et al.) 
[10-13].
* **What it does:** Projects live captions, virtual sign language interpreters, 
or a combination of both directly into the user's natural line of sight using 
smart glasses (e.g., Vuzix Blade 2) [10, 11, 14, 15]. Positioning text or 
signing within the field of view (FOV) eliminates the need to constantly look 
back and forth between screens, slides, and speakers [10, 12, 16-18].
* **Main gap:** Head-locked displays render captions relative to the glasses 
display, causing text to bounce across the visual field during natural head 
movements or nodding (the "paradox of head-locked accessibility"), inducing 
motion sickness and disorientation [19-21]. Without world-locked spatial 
anchoring, AR smart glasses do not fully remove visual split-attention demands 
or focal fatigue [20-23].

---

### **3. Real-Time Environmental Sound Event Recognition Systems**
* **Name:** **Embedded Mobile Sound Recognition Systems** (e.g., UCL Android 
System by Pillos et al., **ProtoSound** / **SoundWatch** by Jain et al., 
OtoSense, CapTune) [24-28].
* **What it does:** Runs continuous, low-power feature extraction (e.g., MFCCs, 
zero-crossing rates) and machine learning classifiers on mobile phones or 
smartwatches to detect ambient non-speech sounds (fire alarms, doorbells, 
crying, laughter) and alert users via visual notifications or vibrotactile 
haptics [24, 26, 28-30].
* **Main gap:** Converting complex acoustic events into static text tags or 
vibration pulses strips away emotional dynamics, pitch, tempo, and spatial 
direction [31-33]. Furthermore, automated ASR pipelines systematically ignore 
background non-speech events (<4% coverage in standard video streams) [32, 33].

---

### **4. Multi-Microphone Spatial Diarization & Target Speaker Identification**
* **Name:** **SpeechCompass** (Android/Google) and **Target Speaker 
Identification Pipeline** (Burke et al. prototype using Diart, Pyannote, and 
TitaNet) [34-37].
* **What it does:** 
  * **SpeechCompass:** Uses a low-power 4-microphone array on a mobile phone 
case to execute real-time Time-Difference-of-Arrival (TDOA) 360° sound 
localization (<20 ms processing, <20° accuracy), displaying directional arrows 
and color-coded speaker diarization on a smartphone app [20, 23, 34, 35, 38-40].
  * **Target Speaker Pipeline:** Combines streaming diarization (Diart) with 
speaker verification (TitaNet/Pyannote) to identify when a registered target 
voice speaks (~1s latency) and triggers selective audio amplification in hearing
aids [36, 37, 41, 42].
* **Main gap:** The ~1-second identification latency in speaker verification 
pipelines is too slow for parsing rapid conversational turns, overlapping 
speech, or brief interjections [42, 43]. SpeechCompass requires specialized 
multi-microphone hardware attachments to achieve 360° spatial accuracy [35, 44, 
45].

---

### **5. Lecture & Presentation Pacing Systems**
* **Name:** **SlidePacer** (Brandão et al. research prototype) [46, 47].
* **What it does:** Coordinates lecture delivery in educational settings by 
holding a projected presentation slide in place until a sign language 
interpreter signals via a mobile app that translation is complete [46, 47]. It 
then applies a configurable "visual processing delay" so DHH students can 
process slide content before the instructor moves on [46, 47].
* **Main gap:** Relies on manual, explicit coordination between the instructor 
and the interpreter rather than automated adaptive tracking, introducing 
artificial pauses into natural lecture or discussion flows [47].

---

💡 *Would you like to explore how combining a low-latency 360° multi-mic array 
like SpeechCompass with a rolling live-objection buffer could form a winning 
hackathon architecture?*

