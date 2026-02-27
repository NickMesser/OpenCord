import { writable, get } from 'svelte/store';
import {
  channelMediaSettingsStore,
  identityStore,
  joinVoiceChannel,
  leaveVoiceChannel,
  onEventInsert,
  sendAudioFrame,
  sendVideoFrame,
  idEq
} from '$lib/stdb';

type ChannelSettings = {
  channelId: bigint;
  audioTargetSampleRate: number;
  audioFrameMs: number;
  audioMaxFrameBytes: number;
  audioBitrateKbps: number;
  audioTalkingRmsThreshold: number;
  videoEnabled: boolean;
  videoWidth: number;
  videoHeight: number;
  videoFps: number;
  videoJpegQuality: number;
  videoMaxFrameBytes: number;
};

const defaultSettings: ChannelSettings = {
  channelId: 0n,
  audioTargetSampleRate: 16000,
  audioFrameMs: 50,
  audioMaxFrameBytes: 64000,
  audioBitrateKbps: 64,
  audioTalkingRmsThreshold: 0.02,
  videoEnabled: false,
  videoWidth: 320,
  videoHeight: 180,
  videoFps: 5,
  videoJpegQuality: 0.55,
  videoMaxFrameBytes: 512000,
};

export const voiceState = writable({
  channelId: null as bigint | null,
  joined: false,
  connecting: false,
  error: null as string | null,
  videoEnabled: false,
});

export const audioLevelsStore = writable<Record<string, { rms: number; at: number }>>({});
export const remoteVideoFramesStore = writable<Record<string, string>>({});
export const localVideoStreamStore = writable<MediaStream | null>(null);
export const audioControlStore = writable({
  muted: false,
  deafened: false,
  inputGain: 1,
  outputGain: 1,
});

let handlersAttached = false;
let activeChannelId: bigint | null = null;
let seq = 0;

let captureCtx: AudioContext | null = null;
let playbackCtx: AudioContext | null = null;
let playbackGain: GainNode | null = null;
let micStream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;
let frameBuffer: number[] = [];
const playbackState = new Map<string, { nextTime: number }>();

let videoStream: MediaStream | null = null;
let videoTimer: number | null = null;
let videoUrlMap = new Map<string, string>();
let inputGainValue = 1;
let outputGainValue = 1;
let isMuted = false;
let isDeafened = false;
let sfxCtx: AudioContext | null = null;

function getSettings(channelId: bigint): ChannelSettings {
  const rows = get(channelMediaSettingsStore) ?? [];
  const row = rows.find((r: any) => idEq(r.channelId ?? r.channel_id, channelId));
  if (!row) return { ...defaultSettings, channelId };
  return {
    channelId,
    audioTargetSampleRate: Number(row.audioTargetSampleRate ?? row.audio_target_sample_rate ?? defaultSettings.audioTargetSampleRate),
    audioFrameMs: Number(row.audioFrameMs ?? row.audio_frame_ms ?? defaultSettings.audioFrameMs),
    audioMaxFrameBytes: Number(row.audioMaxFrameBytes ?? row.audio_max_frame_bytes ?? defaultSettings.audioMaxFrameBytes),
    audioBitrateKbps: Number(row.audioBitrateKbps ?? row.audio_bitrate_kbps ?? defaultSettings.audioBitrateKbps),
    audioTalkingRmsThreshold: Number(row.audioTalkingRmsThreshold ?? row.audio_talking_rms_threshold ?? defaultSettings.audioTalkingRmsThreshold),
    videoEnabled: Boolean(row.videoEnabled ?? row.video_enabled ?? defaultSettings.videoEnabled),
    videoWidth: Number(row.videoWidth ?? row.video_width ?? defaultSettings.videoWidth),
    videoHeight: Number(row.videoHeight ?? row.video_height ?? defaultSettings.videoHeight),
    videoFps: Number(row.videoFps ?? row.video_fps ?? defaultSettings.videoFps),
    videoJpegQuality: Number(row.videoJpegQuality ?? row.video_jpeg_quality ?? defaultSettings.videoJpegQuality),
    videoMaxFrameBytes: Number(row.videoMaxFrameBytes ?? row.video_max_frame_bytes ?? defaultSettings.videoMaxFrameBytes),
  };
}

function identityHex(id: any): string {
  return id?.toHexString?.() ?? '';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ensureSfxContext(): AudioContext | null {
  if (!sfxCtx) {
    try {
      sfxCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (sfxCtx.state === 'suspended') {
    sfxCtx.resume().catch(() => undefined);
  }
  return sfxCtx;
}

function playTone(freq: number, durationMs: number, volume = 0.04) {
  const ctx = ensureSfxContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

function playSfx(kind: 'join' | 'leave' | 'mute' | 'unmute' | 'deafen' | 'undeafen') {
  switch (kind) {
    case 'join':
      playTone(520, 90);
      setTimeout(() => playTone(780, 110), 110);
      break;
    case 'leave':
      playTone(780, 90);
      setTimeout(() => playTone(520, 110), 110);
      break;
    case 'mute':
      playTone(220, 80);
      break;
    case 'unmute':
      playTone(440, 80);
      break;
    case 'deafen':
      playTone(300, 80);
      setTimeout(() => playTone(260, 80), 90);
      break;
    case 'undeafen':
      playTone(380, 80);
      setTimeout(() => playTone(520, 80), 90);
      break;
  }
}

function ensureEventHandlers() {
  if (handlersAttached) return;
  handlersAttached = true;
  onEventInsert('audio_frame_event', handleAudioFrame);
  onEventInsert('video_frame_event', handleVideoFrame);
}

function updateAudioLevel(idHex: string, rms: number) {
  audioLevelsStore.update((levels) => ({
    ...levels,
    [idHex]: { rms, at: Date.now() },
  }));
}

function handleAudioFrame(row: any) {
  if (isDeafened) return;
  if (!activeChannelId || !idEq(row.channelId ?? row.channel_id, activeChannelId)) return;
  const me = get(identityStore);
  if (me && identityHex(row.from) === identityHex(me)) return;

  const idHex = identityHex(row.from);
  updateAudioLevel(idHex, Number(row.rms ?? 0));

  const pcm: Uint8Array = row.pcm16le ?? row.pcm16 ?? row.bytes ?? new Uint8Array();
  if (!pcm || pcm.byteLength === 0) return;

  const channels = Number(row.channels ?? 1);
  const sampleRate = Number(row.sampleRate ?? row.sample_rate ?? defaultSettings.audioTargetSampleRate);
  const int16 = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const frameLength = Math.floor(int16.length / channels);
  if (frameLength <= 0) return;

  if (!playbackCtx) {
    playbackCtx = new AudioContext({ sampleRate });
    playbackGain = playbackCtx.createGain();
    playbackGain.gain.value = outputGainValue;
    playbackGain.connect(playbackCtx.destination);
  }
  if (playbackCtx.state === 'suspended') {
    playbackCtx.resume().catch(() => undefined);
  }

  const buffer = playbackCtx.createBuffer(channels, frameLength, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const out = buffer.getChannelData(ch);
    for (let i = 0; i < frameLength; i++) {
      const sample = int16[i * channels + ch];
      out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
    }
  }

  const state = playbackState.get(idHex) ?? { nextTime: playbackCtx.currentTime };
  const startTime = Math.max(playbackCtx.currentTime, state.nextTime);
  const source = playbackCtx.createBufferSource();
  source.buffer = buffer;
  if (playbackGain) {
    source.connect(playbackGain);
  } else {
    source.connect(playbackCtx.destination);
  }
  source.start(startTime);
  state.nextTime = startTime + buffer.duration;
  playbackState.set(idHex, state);
}

function handleVideoFrame(row: any) {
  if (!activeChannelId || !idEq(row.channelId ?? row.channel_id, activeChannelId)) return;
  const me = get(identityStore);
  if (me && identityHex(row.from) === identityHex(me)) return;

  const idHex = identityHex(row.from);
  const jpeg: Uint8Array = row.jpeg ?? row.bytes ?? new Uint8Array();
  if (!jpeg || jpeg.byteLength === 0) return;

  const blob = new Blob([jpeg], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const prev = videoUrlMap.get(idHex);
  if (prev) URL.revokeObjectURL(prev);
  videoUrlMap.set(idHex, url);
  remoteVideoFramesStore.update((frames) => ({ ...frames, [idHex]: url }));
}

async function startAudioCapture(settings: ChannelSettings) {
  if (captureCtx) return;
  captureCtx = new AudioContext({ sampleRate: settings.audioTargetSampleRate });
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const source = captureCtx.createMediaStreamSource(micStream);
  processor = captureCtx.createScriptProcessor(4096, 1, 1);
  source.connect(processor);
  processor.connect(captureCtx.destination);

  const frameSize = Math.floor(settings.audioTargetSampleRate * (settings.audioFrameMs / 1000));
  frameBuffer = [];
  seq = 0;

  processor.onaudioprocess = (e) => {
    if (!activeChannelId) return;
    const input = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) frameBuffer.push(input[i]);

    while (frameBuffer.length >= frameSize) {
      const frame = frameBuffer.slice(0, frameSize);
      frameBuffer = frameBuffer.slice(frameSize);

      if (isMuted || isDeafened) {
        continue;
      }

      let sum = 0;
      const pcm = new Int16Array(frame.length);
      for (let i = 0; i < frame.length; i++) {
        const s = clamp(frame[i] * inputGainValue, -1, 1);
        sum += s * s;
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const rms = Math.sqrt(sum / frame.length);
      const me = get(identityStore);
      if (me) updateAudioLevel(identityHex(me), rms);
      const bytes = new Uint8Array(pcm.buffer);
      if (bytes.byteLength > settings.audioMaxFrameBytes) continue;

      sendAudioFrame({
        channelId: activeChannelId,
        seq: seq++,
        sampleRate: settings.audioTargetSampleRate,
        channels: 1,
        rms,
        pcm16le: bytes,
      }).catch(() => undefined);
    }
  };
}

function stopAudioCapture() {
  if (processor) {
    processor.disconnect();
    processor.onaudioprocess = null;
  }
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
  }
  if (captureCtx) {
    captureCtx.close().catch(() => undefined);
  }
  processor = null;
  micStream = null;
  captureCtx = null;
  playbackGain = null;
  frameBuffer = [];
}

async function startVideoCapture(settings: ChannelSettings) {
  if (videoStream || !settings.videoEnabled) return;
  videoStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: settings.videoWidth,
      height: settings.videoHeight,
      frameRate: settings.videoFps,
    },
    audio: false,
  });
  localVideoStreamStore.set(videoStream);

  const videoEl = document.createElement('video');
  videoEl.srcObject = videoStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();

  const canvas = document.createElement('canvas');
  canvas.width = settings.videoWidth;
  canvas.height = settings.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const intervalMs = Math.max(100, Math.floor(1000 / settings.videoFps));
  videoTimer = window.setInterval(() => {
    if (!activeChannelId || !videoStream) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob || !activeChannelId) return;
      blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf);
        if (bytes.byteLength > settings.videoMaxFrameBytes) return;
        sendVideoFrame({
          channelId: activeChannelId,
          seq: seq++,
          width: settings.videoWidth,
          height: settings.videoHeight,
          jpeg: bytes,
        }).catch(() => undefined);
      }).catch(() => undefined);
    }, 'image/jpeg', settings.videoJpegQuality);
  }, intervalMs);
}

function stopVideoCapture() {
  if (videoTimer) window.clearInterval(videoTimer);
  if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
  videoTimer = null;
  videoStream = null;
  localVideoStreamStore.set(null);
}

export async function joinVoice(channelId: bigint, opts: { video?: boolean } = {}) {
  if (get(voiceState).connecting) return;
  const current = get(voiceState);
  if (current.joined && current.channelId && !idEq(current.channelId, channelId)) {
    await leaveVoice();
  }
  voiceState.update((s) => ({ ...s, connecting: true, error: null }));
  try {
    await joinVoiceChannel(channelId);
    activeChannelId = channelId;
    ensureEventHandlers();
    const settings = getSettings(channelId);
    await startAudioCapture(settings);
    if (opts.video) {
      await startVideoCapture(settings);
      voiceState.update((s) => ({ ...s, videoEnabled: true }));
    }
    playSfx('join');
    voiceState.set({
      channelId,
      joined: true,
      connecting: false,
      error: null,
      videoEnabled: opts.video ?? false,
    });
  } catch (e: any) {
    voiceState.update((s) => ({
      ...s,
      connecting: false,
      error: e?.message ?? String(e),
    }));
  }
}

export async function leaveVoice() {
  const channelId = activeChannelId;
  activeChannelId = null;
  stopAudioCapture();
  stopVideoCapture();
  playbackState.clear();
  voiceState.set({ channelId: null, joined: false, connecting: false, error: null, videoEnabled: false });
  audioLevelsStore.set({});
  remoteVideoFramesStore.set({});
  for (const url of videoUrlMap.values()) URL.revokeObjectURL(url);
  videoUrlMap.clear();
  if (channelId) {
    await leaveVoiceChannel(channelId);
  }
  playSfx('leave');
}

export async function setVideoEnabled(enable: boolean) {
  const channelId = activeChannelId;
  if (!channelId) return;
  const settings = getSettings(channelId);
  if (enable) {
    await startVideoCapture(settings);
  } else {
    stopVideoCapture();
  }
  voiceState.update((s) => ({ ...s, videoEnabled: enable }));
}

export function setInputGain(value: number) {
  inputGainValue = clamp(value, 0, 2);
  audioControlStore.update((s) => ({ ...s, inputGain: inputGainValue }));
}

export function setOutputGain(value: number) {
  outputGainValue = clamp(value, 0, 2);
  if (playbackGain) playbackGain.gain.value = outputGainValue;
  audioControlStore.update((s) => ({ ...s, outputGain: outputGainValue }));
}

export function toggleMute() {
  isMuted = !isMuted;
  playSfx(isMuted ? 'mute' : 'unmute');
  audioControlStore.update((s) => ({ ...s, muted: isMuted }));
}

export function toggleDeafen() {
  isDeafened = !isDeafened;
  playSfx(isDeafened ? 'deafen' : 'undeafen');
  audioControlStore.update((s) => ({ ...s, deafened: isDeafened }));
}
