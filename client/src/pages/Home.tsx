import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  Download,
  Headphones,
  Mic,
  Mic2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Waves,
  Zap,
} from "lucide-react";

type EffectId = "clean" | "robot" | "space" | "echo" | "alien";
type Recording = { id: number; name: string; duration: string; size: string; url: string };

type Effect = {
  id: EffectId;
  name: string;
  description: string;
  color: string;
  icon: typeof Mic2;
};

const EFFECTS: Effect[] = [
  { id: "clean", name: "Clean voice", description: "Natural studio tone", color: "#8b7cff", icon: Mic2 },
  { id: "robot", name: "Robot", description: "Metallic modulation", color: "#24c8b7", icon: Zap },
  { id: "space", name: "Deep space", description: "Low, cinematic rumble", color: "#ef8eff", icon: Radio },
  { id: "echo", name: "Echo chamber", description: "Wide repeating ambience", color: "#ffad62", icon: Waves },
  { id: "alien", name: "Alien", description: "Glitchy otherworldly", color: "#70c9ff", icon: Sparkles },
];

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
};

export default function Home() {
  const [activeNav, setActiveNav] = useState("Studio");
  const [effect, setEffect] = useState<EffectId>("clean");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [recordDestination, setRecordDestination] = useState<MediaStreamAudioDestinationNode | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [outputLevel, setOutputLevel] = useState(78);
  const [noiseGate, setNoiseGate] = useState(true);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 56 }, (_, index) => 22 + ((index * 17) % 29)));

  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const effectCleanupRef = useRef<(() => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const playbackRef = useRef<HTMLAudioElement | null>(null);

  const selectedEffect = useMemo(() => EFFECTS.find((item) => item.id === effect) ?? EFFECTS[0], [effect]);
  const isArmed = Boolean(stream && audioContext);

  const clearNotice = useCallback(() => {
    window.setTimeout(() => setNotice(""), 3600);
  }, []);

  const disconnectGraph = useCallback(() => {
    effectCleanupRef.current?.();
    effectCleanupRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    outputGainRef.current?.disconnect();
    outputGainRef.current = null;
    setAnalyser(null);
    setRecordDestination(null);
  }, []);

  const buildGraph = useCallback(
    (ctx: AudioContext, activeStream: MediaStream, activeEffect: EffectId) => {
      disconnectGraph();
      const source = ctx.createMediaStreamSource(activeStream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.82;
      const output = ctx.createGain();
      output.gain.value = outputLevel / 100;
      const destination = ctx.createMediaStreamDestination();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 18;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const input = ctx.createGain();
      input.gain.value = 1;
      if (noiseGate) {
        const highpass = ctx.createBiquadFilter();
        highpass.type = "highpass";
        highpass.frequency.value = 72;
        source.connect(highpass);
        highpass.connect(input);
      } else {
        source.connect(input);
      }

      let effectInput: AudioNode = input;
      const cleanupNodes: AudioNode[] = [input];
      const cleanupOscillators: OscillatorNode[] = [];

      if (activeEffect === "robot") {
        const modulator = ctx.createOscillator();
        const modGain = ctx.createGain();
        modulator.type = "square";
        modulator.frequency.value = 48;
        modGain.gain.value = 0.92;
        effectInput.connect(modGain);
        modulator.connect(modGain.gain);
        modulator.start();
        effectInput = modGain;
        cleanupNodes.push(modGain);
        cleanupOscillators.push(modulator);
      }

      if (activeEffect === "space") {
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = "lowpass";
        lowpass.frequency.value = 680;
        lowpass.Q.value = 1.4;
        effectInput.connect(lowpass);
        effectInput = lowpass;
        cleanupNodes.push(lowpass);
      }

      if (activeEffect === "echo") {
        const delay = ctx.createDelay(1.5);
        const feedback = ctx.createGain();
        const wet = ctx.createGain();
        delay.delayTime.value = 0.28;
        feedback.gain.value = 0.46;
        wet.gain.value = 0.64;
        effectInput.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(compressor);
        effectInput.connect(compressor);
        cleanupNodes.push(delay, feedback, wet);
      } else if (activeEffect === "alien") {
        const shaper = ctx.createWaveShaper();
        const bandpass = ctx.createBiquadFilter();
        const curve = new Float32Array(256);
        for (let index = 0; index < curve.length; index += 1) {
          const x = (index * 2) / curve.length - 1;
          curve[index] = Math.sign(x) * (1 - Math.exp(-Math.abs(x) * 3.4));
        }
        shaper.curve = curve;
        shaper.oversample = "4x";
        bandpass.type = "bandpass";
        bandpass.frequency.value = 1240;
        bandpass.Q.value = 4;
        effectInput.connect(shaper);
        shaper.connect(bandpass);
        bandpass.connect(compressor);
        cleanupNodes.push(shaper, bandpass);
      } else {
        effectInput.connect(compressor);
      }

      compressor.connect(output);
      output.connect(analyserNode);
      analyserNode.connect(ctx.destination);
      output.connect(destination);

      sourceRef.current = source;
      outputGainRef.current = output;
      setAnalyser(analyserNode);
      setRecordDestination(destination);
      effectCleanupRef.current = () => {
        cleanupOscillators.forEach((oscillator) => {
          try { oscillator.stop(); } catch { /* already stopped */ }
        });
        cleanupNodes.forEach((node) => node.disconnect());
        compressor.disconnect();
        analyserNode.disconnect();
        destination.disconnect();
      };
    },
    [disconnectGraph, noiseGate, outputLevel],
  );

  const startSession = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not available in this browser.");
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ctx = new AudioContext();
      await ctx.resume();
      setStream(nextStream);
      setAudioContext(ctx);
      buildGraph(ctx, nextStream, effect);
      setNotice("Microphone connected. Pick an effect and press record when you are ready.");
      clearNotice();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Microphone permission was not granted.");
    }
  };

  const stopSession = useCallback(() => {
    if (isRecording) recorderRef.current?.stop();
    stream?.getTracks().forEach((track) => track.stop());
    disconnectGraph();
    audioContext?.close();
    setStream(null);
    setAudioContext(null);
    setIsRecording(false);
    setRecordTime(0);
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, [audioContext, disconnectGraph, isRecording, stream]);

  useEffect(() => {
    if (audioContext && stream) buildGraph(audioContext, stream, effect);
  }, [audioContext, buildGraph, effect, stream]);

  useEffect(() => {
    if (!analyser) return undefined;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const nextLevels = Array.from({ length: 56 }, (_, index) => {
        const value = data[index % data.length] ?? 0;
        return Math.max(8, Math.min(94, 12 + value * 0.76));
      });
      setLevels(nextLevels);
      animationRef.current = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    };
  }, [analyser]);

  useEffect(() => {
    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      if (timerRef.current) window.clearInterval(timerRef.current);
      stream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
    };
  }, [audioContext, stream]);

  useEffect(() => {
    if (outputGainRef.current) outputGainRef.current.gain.value = outputLevel / 100;
  }, [outputLevel]);

  const startRecording = () => {
    if (!recordDestination) {
      setError("Connect your microphone first, then start a recording.");
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
    const recorder = new MediaRecorder(recordDestination.stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setRecordingUrl(url);
      setRecordings((current) => [
        { id: Date.now(), name: `${selectedEffect.name} take`, duration: formatTime(recordTime), size: `${(blob.size / 1024).toFixed(0)} KB`, url },
        ...current,
      ]);
      setNotice("Recording saved to your session library.");
      clearNotice();
    };
    recorder.start();
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setIsRecording(true);
    setRecordTime(0);
    timerRef.current = window.setInterval(() => {
      if (startedAtRef.current) setRecordTime(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };

  const togglePlayback = (url = recordingUrl) => {
    if (!url) return;
    if (!playbackRef.current || playbackRef.current.src !== url) {
      playbackRef.current?.pause();
      playbackRef.current = new Audio(url);
      playbackRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      playbackRef.current.pause();
      setIsPlaying(false);
    } else {
      playbackRef.current.play().then(() => setIsPlaying(true)).catch(() => setError("Playback could not start."));
    }
  };

  const downloadRecording = (url: string, name: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name.replace(/\s+/g, "-").toLowerCase()}.webm`;
    link.click();
  };

  const selectNav = (item: string) => {
    setActiveNav(item);
    if (item === "Studio") return;
    if (item === "Recordings" && recordings.length === 0) {
      setNotice("Your saved takes will appear here after the first recording.");
      clearNotice();
    }
    if (item === "Settings") {
      setNotice("Quick settings are available in the control strip below.");
      clearNotice();
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><AudioLines size={20} strokeWidth={2.5} /></div>
          <div>
            <div className="brand-name">Vox<span>Lab</span></div>
            <div className="brand-subtitle">VOICE STUDIO</div>
          </div>
        </div>

        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {[
            { name: "Studio", icon: Radio },
            { name: "Recordings", icon: Headphones, count: recordings.length },
            { name: "Settings", icon: Settings2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button className={`nav-item ${activeNav === item.name ? "active" : ""}`} key={item.name} onClick={() => selectNav(item.name)}>
                <Icon size={17} />
                <span>{item.name}</span>
                {item.count ? <span className="nav-count">{item.count}</span> : null}
                {activeNav === item.name ? <span className="nav-dot" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />
        <div className="tip-card">
          <div className="tip-icon"><Sparkles size={15} /></div>
          <div>
            <strong>Studio tip</strong>
            <p>Use headphones to hear your effect in real time.</p>
          </div>
        </div>
        <div className="profile-row">
          <div className="avatar">AM</div>
          <div className="profile-copy"><strong>Audio maker</strong><span>Local session</span></div>
          <CircleHelp size={16} className="profile-help" />
        </div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <div>
            <div className="eyebrow"><span className="live-pip" /> LIVE AUDIO WORKSPACE</div>
            <h1>{activeNav === "Studio" ? "Make your voice memorable." : activeNav}</h1>
          </div>
          <div className="topbar-actions">
            <div className={`connection-pill ${isArmed ? "connected" : ""}`}>
              <span className="connection-dot" />
              {isArmed ? "Mic connected" : "Waiting for mic"}
            </div>
            <button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button>
            {!isArmed ? (
              <button className="primary-button compact" onClick={startSession}><Mic size={16} /> Connect mic</button>
            ) : (
              <button className="ghost-button compact" onClick={stopSession}><Square size={14} fill="currentColor" /> End session</button>
            )}
          </div>
        </header>

        {error ? <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}><RotateCcw size={14} /> Dismiss</button></div> : null}
        {notice ? <div className="notice-banner"><BadgeCheck size={15} /><span>{notice}</span></div> : null}

        {activeNav === "Recordings" ? (
          <section className="recordings-view page-enter">
            <div className="section-heading"><div><span className="section-kicker">SESSION LIBRARY</span><h2>Your recordings</h2></div><span className="library-count">{recordings.length} {recordings.length === 1 ? "take" : "takes"}</span></div>
            {recordings.length === 0 ? (
              <div className="empty-library"><div className="empty-orb"><Mic2 size={30} /></div><h3>No takes yet</h3><p>Start a recording in Studio and your processed audio will show up here.</p><button className="primary-button" onClick={() => setActiveNav("Studio")}><Radio size={16} /> Open studio</button></div>
            ) : (
              <div className="library-list">{recordings.map((item) => <RecordingRow key={item.id} item={item} onPlay={() => togglePlayback(item.url)} onDownload={() => downloadRecording(item.url, item.name)} />)}</div>
            )}
          </section>
        ) : (
          <>
            <section className="hero-grid page-enter">
              <div className="visualizer-card">
                <div className="card-topline"><span className="card-label">SIGNAL MONITOR</span><span className={`monitor-status ${isArmed ? "active" : ""}`}><span /> {isArmed ? "Listening" : "Standby"}</span></div>
                <div className="waveform-area" aria-label="Audio waveform visualization">
                  <div className="waveform-grid" />
                  <div className="waveform-bars">{levels.map((height, index) => <span key={index} style={{ height: `${isArmed ? height : Math.max(12, height * 0.55)}%`, opacity: isArmed ? 0.55 + (index % 4) * 0.1 : 0.4 }} />)}</div>
                  {!isArmed ? <div className="waveform-prompt"><div className="prompt-ring"><Mic size={21} /></div><span>Connect your microphone to begin</span></div> : null}
                  {isRecording ? <div className="recording-indicator"><span className="recording-pip" /> Recording <strong>{formatTime(recordTime)}</strong></div> : null}
                </div>
                <div className="monitor-footer"><div className="meter-label"><span>INPUT</span><span>{isArmed ? "-12.4 dB" : "—"}</span></div><div className="meter-track"><div className="meter-fill" style={{ width: isArmed ? "68%" : "4%" }} /></div><div className="meter-label right"><span>OUTPUT</span><span>{outputLevel}%</span></div></div>
              </div>

              <div className="record-card">
                <div className="record-orbit" />
                <div className="record-card-content"><span className="card-label">CURRENT EFFECT</span><div className="current-effect-icon" style={{ color: selectedEffect.color, background: `${selectedEffect.color}18` }}><selectedEffect.icon size={26} /></div><h2>{selectedEffect.name}</h2><p>{selectedEffect.description}</p><div className="record-time">{formatTime(recordTime)}</div></div>
                <button className={`record-button ${isRecording ? "recording" : ""}`} onClick={isRecording ? stopRecording : startRecording} aria-label={isRecording ? "Stop recording" : "Start recording"}><span>{isRecording ? <Square size={21} fill="currentColor" /> : <Mic size={26} />}</span></button>
                <div className="record-hint">{isRecording ? "Tap to stop" : isArmed ? "Tap to record" : "Connect mic first"}</div>
              </div>
            </section>

            <section className="effects-section">
              <div className="section-heading"><div><span className="section-kicker">VOICE PRESETS</span><h2>Choose your sound</h2></div><button className="view-all">View all <ChevronDown size={15} /></button></div>
              <div className="effect-grid">{EFFECTS.map((item) => { const Icon = item.icon; return <button key={item.id} className={`effect-card ${effect === item.id ? "selected" : ""}`} onClick={() => setEffect(item.id)} style={{ "--effect-color": item.color } as React.CSSProperties}><div className="effect-icon"><Icon size={19} /></div><span className="effect-name">{item.name}</span><span className="effect-description">{item.description}</span>{effect === item.id ? <span className="selected-check"><BadgeCheck size={14} /></span> : null}</button>; })}</div>
            </section>

            <section className="controls-strip">
              <div className="control-group"><div className="control-heading"><span>Output level</span><strong>{outputLevel}%</strong></div><div className="range-wrap"><Volume2 size={16} /><input aria-label="Output level" type="range" min="0" max="100" value={outputLevel} onChange={(event) => setOutputLevel(Number(event.target.value))} /><span className="range-end">100</span></div></div>
              <div className="control-divider" />
              <div className="control-group gate-group"><div className="control-heading"><span>Noise gate</span><button className={`switch ${noiseGate ? "on" : ""}`} onClick={() => setNoiseGate((current) => !current)} aria-label="Toggle noise gate"><span /></button></div><p>Reduce room noise between words</p></div>
              <div className="control-divider" />
              <div className="quick-action"><div className="quick-action-icon"><Headphones size={16} /></div><div><strong>Monitor with headphones</strong><span>Recommended for live effects</span></div></div>
            </section>

            {recordingUrl ? <section className="latest-take"><div className="latest-copy"><div className="take-icon"><AudioLines size={17} /></div><div><span className="section-kicker">LATEST TAKE</span><strong>{selectedEffect.name} take</strong><span>Ready to preview or download</span></div></div><div className="take-actions"><button className="secondary-button" onClick={() => togglePlayback()}>{isPlaying ? <Pause size={15} /> : <Play size={15} />}{isPlaying ? "Pause" : "Preview"}</button><button className="primary-button" onClick={() => downloadRecording(recordingUrl, `${selectedEffect.name} take`)}><Download size={15} /> Download</button></div></section> : null}
          </>
        )}
        <footer className="footer-note"><span>VoxLab runs locally in your browser.</span><span className="footer-separator">•</span><span>No audio is uploaded.</span></footer>
      </main>
    </div>
  );
}

function RecordingRow({ item, onPlay, onDownload }: { item: Recording; onPlay: () => void; onDownload: () => void }) {
  return <div className="recording-row"><div className="row-play" onClick={onPlay}><Play size={16} fill="currentColor" /></div><div className="row-wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div><div className="row-details"><strong>{item.name}</strong><span>{item.duration} · {item.size}</span></div><button className="row-action" onClick={onDownload} aria-label={`Download ${item.name}`}><Download size={16} /></button><button className="row-action muted" aria-label="Delete recording"><Trash2 size={16} /></button></div>;
}
