import { StatusBar } from 'expo-status-bar';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

const COLORS = {
  bg: '#0B0C13',
  panel: '#151722',
  panel2: '#1B1D2A',
  border: '#292B3B',
  text: '#F6F5FC',
  muted: '#8B8C9F',
  faint: '#5D6074',
  violet: '#9A8CFF',
  violetSoft: '#312B58',
  cyan: '#45D5C3',
  rose: '#F18AAE',
};

const PRESETS = [
  { id: 'natural', name: 'Natural Woman', detail: 'Balanced & clear', color: COLORS.violet },
  { id: 'soft', name: 'Soft Female', detail: 'Warm & gentle', color: '#EE9EC6' },
  { id: 'bright', name: 'Bright Female', detail: 'Airy & present', color: '#5ED4DC' },
  { id: 'deep', name: 'Deep Woman', detail: 'Low & cinematic', color: '#B79CFF' },
];

const BARS = Array.from({ length: 58 }, (_, index) => 12 + ((index * 19) % 48));

function formatDuration(seconds: number) {
  const minute = Math.floor(seconds / 60).toString().padStart(2, '0');
  const second = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minute}:${second}`;
}

export default function App() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const [selectedPreset, setSelectedPreset] = useState('natural');
  const [activeTab, setActiveTab] = useState('Studio');
  const [noiseGate, setNoiseGate] = useState(true);
  const [headphones, setHeadphones] = useState(true);
  const [pitch, setPitch] = useState(4);
  const [formant, setFormant] = useState(58);
  const [brightness, setBrightness] = useState(62);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const player = useAudioPlayer(recordingUri);
  const playerStatus = useAudioPlayerStatus(player);
  const activePreset = useMemo(() => PRESETS.find((item) => item.id === selectedPreset) ?? PRESETS[0], [selectedPreset]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => undefined);
  }, []);

  const connectMicrophone = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone permission needed', 'Allow microphone access in Android settings to use VoxLab Studio.');
      return;
    }
    setIsReady(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleRecord = async () => {
    if (!isReady) {
      await connectMicrophone();
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (recorderState.isRecording) {
      await recorder.stop();
      setRecordingUri(recorder.uri);
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const togglePlayback = () => {
    if (!recordingUri) return;
    if (playerStatus.playing) player.pause();
    else player.play();
  };

  const cycle = (value: number, min: number, max: number, amount: number) => Math.min(max, Math.max(min, value + amount));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}><Text style={styles.logoGlyph}>∿</Text></View>
            <View><Text style={styles.brand}>Vox<Text style={{ color: COLORS.violet }}>Lab</Text></Text><Text style={styles.brandMeta}>AI VOICE STUDIO</Text></View>
          </View>
          <View style={styles.headerRight}><View style={[styles.statusPill, isReady && styles.statusPillReady]}><View style={[styles.statusDot, isReady && styles.statusDotReady]} /><Text style={styles.statusText}>{isReady ? 'READY' : 'OFFLINE'}</Text></View><Pressable style={styles.more}><Text style={styles.moreText}>•••</Text></Pressable></View>
        </View>

        <View style={styles.tabBar}>
          {['Studio', 'Recordings'].map((tab) => <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]}><Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>{activeTab === tab && <View style={styles.tabLine} />}</Pressable>)}
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'Studio' ? <>
            <View style={styles.titleRow}><View><Text style={styles.eyebrow}>LIVE WORKSPACE</Text><Text style={styles.title}>Find your real voice.</Text><Text style={styles.subtitle}>Build a natural feminine voice profile.</Text></View><View style={styles.privacy}><Text style={styles.lock}>⌁</Text><Text style={styles.privacyText}>LOCAL</Text></View></View>

            <View style={styles.monitorCard}>
              <View style={styles.cardHeading}><Text style={styles.cardLabel}>SIGNAL MONITOR</Text><Text style={[styles.listenText, isReady && { color: COLORS.cyan }]}><View style={[styles.tinyDot, isReady && { backgroundColor: COLORS.cyan }]} /> {isReady ? 'Listening' : 'Standby'}</Text></View>
              <View style={styles.waveArea}>
                <View style={styles.centerLine} />
                <View style={styles.wave}>{BARS.map((height, index) => <View key={index} style={[styles.waveBar, { height: isReady ? height : height * .55, backgroundColor: index % 4 === 0 ? COLORS.cyan : COLORS.violet, opacity: isReady ? .9 : .42 }]} />)}</View>
                {!isReady && <View style={styles.wavePrompt}><View style={styles.micOrb}><Text style={styles.micGlyph}>⌁</Text></View><Text style={styles.promptText}>Connect microphone to monitor</Text></View>}
                {recorderState.isRecording && <View style={styles.recordingBadge}><View style={styles.recordingDot} /><Text style={styles.recordingText}>RECORDING  {formatDuration(recorderState.durationMillis / 1000)}</Text></View>}
              </View>
              <View style={styles.meters}><View style={styles.meterLabel}><Text style={styles.meterTitle}>INPUT</Text><Text style={styles.meterValue}>{isReady ? '-12.4 dB' : '—'}</Text></View><View style={styles.meterTrack}><View style={[styles.meterFill, { width: isReady ? '67%' : '4%' }]} /></View><View style={styles.meterLabel}><Text style={styles.meterTitle}>OUTPUT</Text><Text style={styles.meterValue}>-8.0 dB</Text></View></View>
            </View>

            <View style={styles.recordRow}><View><Text style={styles.eyebrow}>ACTIVE PROFILE</Text><Text style={styles.activeName}>{activePreset.name}</Text><Text style={styles.activeDetail}>{activePreset.detail} · conversion-ready</Text></View><Pressable onPress={toggleRecord} style={({ pressed }) => [styles.recordButton, recorderState.isRecording && styles.recordButtonStop, pressed && styles.pressed]}><Text style={styles.recordIcon}>{recorderState.isRecording ? '■' : '●'}</Text></Pressable></View>
            <Text style={styles.tapHint}>{recorderState.isRecording ? 'Tap to stop and save' : isReady ? 'Tap to record a new take' : 'Tap to grant microphone access'}</Text>

            <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>VOICE PRESETS</Text><Text style={styles.sectionTitle}>Choose your sound</Text></View><Text style={styles.countText}>4 presets</Text></View>
            <View style={styles.presetGrid}>{PRESETS.map((preset) => <Pressable key={preset.id} onPress={() => { setSelectedPreset(preset.id); Haptics.selectionAsync(); }} style={[styles.preset, selectedPreset === preset.id && { borderColor: preset.color, backgroundColor: COLORS.violetSoft }]}><View style={[styles.presetIcon, { borderColor: preset.color, backgroundColor: `${preset.color}18` }]}><Text style={{ color: preset.color, fontSize: 19 }}>∿</Text></View><Text style={styles.presetName}>{preset.name}</Text><Text style={styles.presetDetail}>{preset.detail}</Text>{selectedPreset === preset.id && <View style={[styles.selectedMark, { backgroundColor: preset.color }]}><Text style={styles.check}>✓</Text></View>}</Pressable>)}</View>

            <View style={styles.controlsCard}><View style={styles.cardHeading}><Text style={styles.cardLabel}>FEMININE VOICE PROFILE</Text><Text style={styles.aiReady}><View style={styles.tinyDot} /> READY</Text></View><ControlRow label="Pitch lift" value={`+${pitch}.0 st`} hint="Natural range" onMinus={() => setPitch(cycle(pitch, 0, 8, -1))} onPlus={() => setPitch(cycle(pitch, 0, 8, 1))} /><ControlRow label="Formant" value={`${formant}%`} hint="Feminine resonance" onMinus={() => setFormant(cycle(formant, 0, 100, -5))} onPlus={() => setFormant(cycle(formant, 0, 100, 5))} /><ControlRow label="Brightness" value={`${brightness}%`} hint="Air & clarity" onMinus={() => setBrightness(cycle(brightness, 0, 100, -5))} onPlus={() => setBrightness(cycle(brightness, 0, 100, 5))} /><View style={styles.settingRow}><View><Text style={styles.settingName}>Noise gate</Text><Text style={styles.settingHint}>Clean gaps between words</Text></View><Switch value={noiseGate} onValueChange={setNoiseGate} trackColor={{ false: '#343647', true: '#4D967E' }} thumbColor={noiseGate ? COLORS.cyan : '#8B8C9F'} /></View><View style={styles.settingRow}><View><Text style={styles.settingName}>Headphone monitor</Text><Text style={styles.settingHint}>Recommended for live feedback</Text></View><Switch value={headphones} onValueChange={setHeadphones} trackColor={{ false: '#343647', true: '#4D967E' }} thumbColor={headphones ? COLORS.cyan : '#8B8C9F'} /></View></View>

            {recordingUri && <View style={styles.savedCard}><View style={styles.savedIcon}><Text style={{ color: COLORS.violet, fontSize: 18 }}>♪</Text></View><View style={{ flex: 1 }}><Text style={styles.savedTitle}>{activePreset.name} take</Text><Text style={styles.savedMeta}>Saved locally · ready to preview</Text></View><Pressable onPress={togglePlayback} style={styles.playButton}><Text style={styles.playGlyph}>{playerStatus.playing ? 'Ⅱ' : '▶'}</Text></Pressable></View>}
          </> : <RecordingsView hasRecording={Boolean(recordingUri)} onBack={() => setActiveTab('Studio')} />}
          <Text style={styles.footer}>VoxLab records locally. A native DSP/AI conversion engine can be connected to this profile.</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function ControlRow({ label, value, hint, onMinus, onPlus }: { label: string; value: string; hint: string; onMinus: () => void; onPlus: () => void }) {
  return <View style={styles.controlRow}><View style={{ flex: 1 }}><Text style={styles.settingName}>{label}</Text><Text style={styles.settingHint}>{hint}</Text></View><View style={styles.stepper}><Pressable onPress={onMinus} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable onPress={onPlus} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View></View>;
}

function RecordingsView({ hasRecording, onBack }: { hasRecording: boolean; onBack: () => void }) {
  return <View style={styles.library}><Text style={styles.eyebrow}>SESSION LIBRARY</Text><View style={styles.libraryTitleRow}><Text style={styles.sectionTitle}>Your recordings</Text><Text style={styles.countText}>{hasRecording ? '1 take' : '0 takes'}</Text></View><View style={styles.emptyLibrary}><View style={styles.emptyOrb}><Text style={{ color: COLORS.violet, fontSize: 28 }}>♪</Text></View><Text style={styles.emptyTitle}>{hasRecording ? 'Your latest take is ready' : 'No takes yet'}</Text><Text style={styles.emptyCopy}>{hasRecording ? 'Return to Studio to preview your processed voice.' : 'Record a processed voice take and it will appear here.'}</Text><Pressable onPress={onBack} style={styles.openButton}><Text style={styles.openButtonText}>Open Studio</Text></Pressable></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg }, shell: { flex: 1, backgroundColor: COLORS.bg }, header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 37, height: 37, borderRadius: 12, backgroundColor: COLORS.violet, justifyContent: 'center', alignItems: 'center' }, logoGlyph: { color: '#FFF', fontSize: 27, lineHeight: 25, fontWeight: '300' }, brand: { color: COLORS.text, fontWeight: '800', fontSize: 20, letterSpacing: -1 }, brandMeta: { color: COLORS.faint, fontSize: 8, letterSpacing: 1.6, marginTop: 2 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 }, statusPill: { flexDirection: 'row', gap: 6, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 7 }, statusPillReady: { borderColor: '#2C655D', backgroundColor: '#11211F' }, statusDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: COLORS.faint }, statusDotReady: { backgroundColor: COLORS.cyan }, statusText: { color: COLORS.muted, fontSize: 8, fontWeight: '700', letterSpacing: 1 }, more: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center' }, moreText: { color: COLORS.muted, fontSize: 14, marginTop: -7 }, tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 20, gap: 24 }, tab: { paddingBottom: 12, position: 'relative' }, tabActive: {}, tabLine: { position: 'absolute', height: 2, backgroundColor: COLORS.violet, left: 0, right: 0, bottom: -1, borderRadius: 2 }, tabText: { color: COLORS.faint, fontSize: 12, fontWeight: '600' }, tabTextActive: { color: COLORS.text }, content: { padding: 20, paddingBottom: 32 }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 19 }, eyebrow: { color: '#77798F', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }, title: { color: COLORS.text, fontSize: 27, fontWeight: '800', letterSpacing: -1.2, marginTop: 6 }, subtitle: { color: COLORS.muted, fontSize: 11, marginTop: 5 }, privacy: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: '#293E3A', backgroundColor: '#11201E', paddingHorizontal: 8, paddingVertical: 6 }, lock: { color: COLORS.cyan, fontSize: 13 }, privacyText: { color: COLORS.cyan, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, monitorCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, backgroundColor: COLORS.panel, padding: 16, marginBottom: 16 }, cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardLabel: { color: COLORS.faint, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }, listenText: { color: COLORS.faint, fontSize: 9 }, tinyDot: { width: 6, height: 6, borderRadius: 5, backgroundColor: COLORS.faint }, waveArea: { height: 184, justifyContent: 'center', marginVertical: 7, overflow: 'hidden', position: 'relative' }, centerLine: { position: 'absolute', height: 1, backgroundColor: '#3B3C52', left: 0, right: 0, top: '50%' }, wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 155 }, waveBar: { width: 3, borderRadius: 4 }, wavePrompt: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 9 }, micOrb: { width: 45, height: 45, borderRadius: 24, borderWidth: 1, borderColor: '#5C55A0', backgroundColor: '#242147', alignItems: 'center', justifyContent: 'center' }, micGlyph: { color: COLORS.violet, fontSize: 25 }, promptText: { color: COLORS.faint, fontSize: 10 }, recordingBadge: { position: 'absolute', top: 5, alignSelf: 'center', flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: '#71404D', backgroundColor: '#2A171F', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 }, recordingDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: COLORS.rose }, recordingText: { color: '#F7A3B9', fontSize: 8, fontWeight: '800', letterSpacing: 1 }, meters: { flexDirection: 'row', gap: 9, alignItems: 'center' }, meterLabel: { flexDirection: 'row', gap: 6, alignItems: 'center' }, meterTitle: { color: COLORS.faint, fontSize: 8, fontWeight: '700' }, meterValue: { color: COLORS.muted, fontSize: 8 }, meterTrack: { flex: 1, height: 3, backgroundColor: '#303243', borderRadius: 4 }, meterFill: { height: 3, backgroundColor: COLORS.violet, borderRadius: 4 }, recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 }, activeName: { color: COLORS.text, fontSize: 19, fontWeight: '800', marginTop: 5 }, activeDetail: { color: COLORS.muted, fontSize: 10, marginTop: 4 }, recordButton: { width: 62, height: 62, borderRadius: 32, backgroundColor: COLORS.violet, borderWidth: 5, borderColor: '#2D2A4D', justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.violet, shadowOpacity: .35, shadowRadius: 12, elevation: 6 }, recordButtonStop: { backgroundColor: COLORS.rose }, recordIcon: { color: '#FFF', fontSize: 20 }, pressed: { transform: [{ scale: .95 }], opacity: .86 }, tapHint: { color: COLORS.faint, textAlign: 'right', fontSize: 9, marginTop: -4, marginBottom: 25 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 13 }, sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginTop: 5, letterSpacing: -.5 }, countText: { color: COLORS.faint, fontSize: 10 }, presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 }, preset: { width: '48.5%', minHeight: 113, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panel, borderRadius: 12, padding: 12, position: 'relative' }, presetIcon: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }, presetName: { color: COLORS.text, fontSize: 10, fontWeight: '800' }, presetDetail: { color: COLORS.faint, fontSize: 9, marginTop: 3 }, selectedMark: { position: 'absolute', top: 10, right: 10, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, check: { color: '#171622', fontSize: 11, fontWeight: '900' }, controlsCard: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panel, borderRadius: 16, padding: 16, gap: 12 }, aiReady: { color: COLORS.cyan, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, controlRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#242633', paddingBottom: 11 }, settingName: { color: '#DAD9E5', fontSize: 11, fontWeight: '700' }, settingHint: { color: COLORS.faint, fontSize: 9, marginTop: 3 }, stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 }, stepButton: { width: 27, height: 27, borderRadius: 7, backgroundColor: COLORS.panel2, alignItems: 'center', justifyContent: 'center' }, stepText: { color: COLORS.violet, fontSize: 18, lineHeight: 19 }, stepValue: { color: COLORS.violet, width: 48, textAlign: 'center', fontSize: 11, fontWeight: '800' }, settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, savedCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14, padding: 13, borderWidth: 1, borderColor: '#3B356C', backgroundColor: '#1C1932', borderRadius: 12 }, savedIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#302A5B', alignItems: 'center', justifyContent: 'center' }, savedTitle: { color: COLORS.text, fontSize: 11, fontWeight: '800' }, savedMeta: { color: COLORS.muted, fontSize: 9, marginTop: 3 }, playButton: { width: 32, height: 32, borderRadius: 17, backgroundColor: COLORS.violet, alignItems: 'center', justifyContent: 'center' }, playGlyph: { color: '#FFF', fontSize: 13 }, footer: { color: '#515366', fontSize: 9, textAlign: 'center', lineHeight: 15, marginTop: 26 }, library: { paddingTop: 8 }, libraryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 }, emptyLibrary: { minHeight: 350, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#373556', borderRadius: 16, padding: 26 }, emptyOrb: { width: 68, height: 68, borderRadius: 35, backgroundColor: '#201D3A', borderWidth: 1, borderColor: '#554B9B', alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '800', marginTop: 20 }, emptyCopy: { color: COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'center', maxWidth: 245, marginTop: 7, marginBottom: 18 }, openButton: { borderRadius: 8, backgroundColor: COLORS.violet, paddingVertical: 10, paddingHorizontal: 17 }, openButtonText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
});
