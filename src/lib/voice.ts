import { writable, get } from 'svelte/store';
import {
  channelMediaSettingsStore,
  identityStore,
  joinVoiceChannel,
  joinDmCall,
  leaveVoiceChannel,
  leaveDmCall,
  onEventInsert,
  sendAudioFrame,
  sendDmAudioFrame,
  sendDmVideoFrame,
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

export type ScreenShareQuality = 'low' | 'medium' | 'high';

const screenSharePresets: Record<ScreenShareQuality, {
  width: number;
  height: number;
  fps: number;
  jpegQuality: number;
  maxFrameBytes: number;
}> = {
  low: { width: 640, height: 360, fps: 10, jpegQuality: 0.45, maxFrameBytes: 250000 },
  medium: { width: 960, height: 540, fps: 12, jpegQuality: 0.55, maxFrameBytes: 400000 },
  high: { width: 1280, height: 720, fps: 15, jpegQuality: 0.65, maxFrameBytes: 700000 },
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
  screenSharing: false,
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

export const dmCallState = writable({
  threadId: null as bigint | null,
  joined: false,
  connecting: false,
  error: null as string | null,
  videoEnabled: false,
  screenSharing: false,
});

export const dmAudioLevelsStore = writable<Record<string, { rms: number; at: number }>>({});
export const dmRemoteVideoFramesStore = writable<Record<string, string>>({});
export const dmLocalVideoStreamStore = writable<MediaStream | null>(null);

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
let screenStream: MediaStream | null = null;
let screenTimer: number | null = null;
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

function getScreenSharePreset(quality: ScreenShareQuality, settings: ChannelSettings) {
  const preset = screenSharePresets[quality] ?? screenSharePresets.medium;
  return {
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    jpegQuality: preset.jpegQuality,
    maxFrameBytes: Math.min(settings.videoMaxFrameBytes, preset.maxFrameBytes),
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

  const blob = new Blob([jpeg as unknown as BlobPart], { type: 'image/jpeg' });
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
        const targetChannelId = activeChannelId;
        if (!targetChannelId) return;
        sendVideoFrame({
          channelId: targetChannelId,
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

async function startScreenShare(settings: ChannelSettings, quality: ScreenShareQuality) {
  if (screenStream) return;
  const preset = getScreenSharePreset(quality, settings);
  screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: preset.width,
      height: preset.height,
      frameRate: preset.fps,
    },
    audio: false,
  });
  localVideoStreamStore.set(screenStream);

  const track = screenStream.getVideoTracks()[0];
  if (track) {
    track.onended = () => {
      stopScreenShare();
    };
  }

  const videoEl = document.createElement('video');
  videoEl.srcObject = screenStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();

  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const intervalMs = Math.max(100, Math.floor(1000 / preset.fps));
  screenTimer = window.setInterval(() => {
    if (!activeChannelId || !screenStream) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob || !activeChannelId) return;
      blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf);
        if (bytes.byteLength > preset.maxFrameBytes) return;
        const targetChannelId = activeChannelId;
        if (!targetChannelId) return;
        sendVideoFrame({
          channelId: targetChannelId,
          seq: seq++,
          width: preset.width,
          height: preset.height,
          jpeg: bytes,
        }).catch(() => undefined);
      }).catch(() => undefined);
    }, 'image/jpeg', preset.jpegQuality);
  }, intervalMs);
}

function stopScreenShare() {
  if (screenTimer) window.clearInterval(screenTimer);
  if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
  screenTimer = null;
  screenStream = null;
  localVideoStreamStore.set(videoStream ?? null);
  voiceState.update((s) => ({ ...s, screenSharing: false }));
}

export async function joinVoice(channelId: bigint, opts: { video?: boolean } = {}) {
  if (get(voiceState).connecting) return;
  if (get(dmCallState).joined || get(dmCallState).connecting) {
    await leaveDmVoice();
  }
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
      screenSharing: false,
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
  stopScreenShare();
  playbackState.clear();
  voiceState.set({
    channelId: null,
    joined: false,
    connecting: false,
    error: null,
    videoEnabled: false,
    screenSharing: false,
  });
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
    stopScreenShare();
    await startVideoCapture(settings);
  } else {
    stopVideoCapture();
  }
  voiceState.update((s) => ({ ...s, videoEnabled: enable }));
}

export async function setScreenShareEnabled(enable: boolean, quality: ScreenShareQuality = 'medium') {
  const channelId = activeChannelId;
  if (!channelId) return;
  const settings = getSettings(channelId);
  if (enable) {
    stopVideoCapture();
    voiceState.update((s) => ({ ...s, videoEnabled: false, error: null }));
    try {
      await startScreenShare(settings, quality);
      voiceState.update((s) => ({ ...s, screenSharing: true }));
    } catch (e: any) {
      const name = e?.name ?? '';
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        voiceState.update((s) => ({ ...s, error: e?.message ?? String(e) }));
      }
      stopScreenShare();
    }
  } else {
    stopScreenShare();
  }
}

export function setInputGain(value: number) {
  inputGainValue = clamp(value, 0, 2);
  audioControlStore.update((s) => ({ ...s, inputGain: inputGainValue }));
}

export function setOutputGain(value: number) {
  outputGainValue = clamp(value, 0, 2);
  if (playbackGain) playbackGain.gain.value = outputGainValue;
  if (dmPlaybackGain) dmPlaybackGain.gain.value = outputGainValue;
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

let dmHandlersAttached = false;
let dmActiveThreadId: bigint | null = null;
let dmSeq = 0;
let dmCaptureCtx: AudioContext | null = null;
let dmPlaybackCtx: AudioContext | null = null;
let dmPlaybackGain: GainNode | null = null;
let dmMicStream: MediaStream | null = null;
let dmProcessor: ScriptProcessorNode | null = null;
let dmFrameBuffer: number[] = [];
const dmPlaybackState = new Map<string, { nextTime: number }>();
let dmVideoStream: MediaStream | null = null;
let dmVideoTimer: number | null = null;
let dmScreenStream: MediaStream | null = null;
let dmScreenTimer: number | null = null;
let dmVideoUrlMap = new Map<string, string>();

function ensureDmEventHandlers() {
  if (dmHandlersAttached) return;
  dmHandlersAttached = true;
  onEventInsert('dm_audio_frame_event', handleDmAudioFrame);
  onEventInsert('dm_video_frame_event', handleDmVideoFrame);
}

function handleDmAudioFrame(row: any) {
  if (isDeafened) return;
  if (!dmActiveThreadId || !idEq(row.threadId ?? row.thread_id, dmActiveThreadId)) return;
  const me = get(identityStore);
  if (me && identityHex(row.from) === identityHex(me)) return;

  const idHex = identityHex(row.from);
  dmAudioLevelsStore.update((levels) => ({
    ...levels,
    [idHex]: { rms: Number(row.rms ?? 0), at: Date.now() },
  }));

  const pcm: Uint8Array = row.pcm16le ?? new Uint8Array();
  if (!pcm || pcm.byteLength === 0) return;
  const channels = Number(row.channels ?? 1);
  const sampleRate = Number(row.sampleRate ?? row.sample_rate ?? 16000);
  const int16 = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const frameLength = Math.floor(int16.length / channels);
  if (frameLength <= 0) return;

  if (!dmPlaybackCtx) {
    dmPlaybackCtx = new AudioContext({ sampleRate });
    dmPlaybackGain = dmPlaybackCtx.createGain();
    dmPlaybackGain.gain.value = outputGainValue;
    dmPlaybackGain.connect(dmPlaybackCtx.destination);
  }
  if (dmPlaybackCtx.state === 'suspended') {
    dmPlaybackCtx.resume().catch(() => undefined);
  }

  const buffer = dmPlaybackCtx.createBuffer(channels, frameLength, sampleRate);
  for (let ch = 0; ch < channels; ch++) {
    const out = buffer.getChannelData(ch);
    for (let i = 0; i < frameLength; i++) {
      const sample = int16[i * channels + ch];
      out[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
    }
  }

  const state = dmPlaybackState.get(idHex) ?? { nextTime: dmPlaybackCtx.currentTime };
  const startTime = Math.max(dmPlaybackCtx.currentTime, state.nextTime);
  const source = dmPlaybackCtx.createBufferSource();
  source.buffer = buffer;
  if (dmPlaybackGain) source.connect(dmPlaybackGain);
  else source.connect(dmPlaybackCtx.destination);
  source.start(startTime);
  state.nextTime = startTime + buffer.duration;
  dmPlaybackState.set(idHex, state);
}

function handleDmVideoFrame(row: any) {
  if (!dmActiveThreadId || !idEq(row.threadId ?? row.thread_id, dmActiveThreadId)) return;
  const me = get(identityStore);
  if (me && identityHex(row.from) === identityHex(me)) return;
  const idHex = identityHex(row.from);
  const jpeg: Uint8Array = row.jpeg ?? new Uint8Array();
  if (!jpeg || jpeg.byteLength === 0) return;
  const blob = new Blob([jpeg as unknown as BlobPart], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  const prev = dmVideoUrlMap.get(idHex);
  if (prev) URL.revokeObjectURL(prev);
  dmVideoUrlMap.set(idHex, url);
  dmRemoteVideoFramesStore.update((frames) => ({ ...frames, [idHex]: url }));
}

async function startDmAudioCapture(sampleRate = 16000, frameMs = 50) {
  if (dmCaptureCtx) return;
  dmCaptureCtx = new AudioContext({ sampleRate });
  dmMicStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
  const source = dmCaptureCtx.createMediaStreamSource(dmMicStream);
  dmProcessor = dmCaptureCtx.createScriptProcessor(4096, 1, 1);
  source.connect(dmProcessor);
  dmProcessor.connect(dmCaptureCtx.destination);

  const frameSize = Math.floor(sampleRate * (frameMs / 1000));
  dmFrameBuffer = [];
  dmSeq = 0;

  dmProcessor.onaudioprocess = (e) => {
    if (!dmActiveThreadId) return;
    const input = e.inputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) dmFrameBuffer.push(input[i]);
    while (dmFrameBuffer.length >= frameSize) {
      const frame = dmFrameBuffer.slice(0, frameSize);
      dmFrameBuffer = dmFrameBuffer.slice(frameSize);
      if (isMuted || isDeafened) continue;

      let sum = 0;
      const pcm = new Int16Array(frame.length);
      for (let i = 0; i < frame.length; i++) {
        const s = clamp(frame[i] * inputGainValue, -1, 1);
        sum += s * s;
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const rms = Math.sqrt(sum / frame.length);
      const me = get(identityStore);
      if (me) {
        const meHex = identityHex(me);
        dmAudioLevelsStore.update((levels) => ({ ...levels, [meHex]: { rms, at: Date.now() } }));
      }
      sendDmAudioFrame({
        threadId: dmActiveThreadId,
        seq: dmSeq++,
        sampleRate,
        channels: 1,
        rms,
        pcm16le: new Uint8Array(pcm.buffer),
      }).catch(() => undefined);
    }
  };
}

function stopDmAudioCapture() {
  if (dmProcessor) {
    dmProcessor.disconnect();
    dmProcessor.onaudioprocess = null;
  }
  if (dmMicStream) dmMicStream.getTracks().forEach((t) => t.stop());
  if (dmCaptureCtx) dmCaptureCtx.close().catch(() => undefined);
  dmProcessor = null;
  dmMicStream = null;
  dmCaptureCtx = null;
  dmFrameBuffer = [];
}

async function startDmVideoCapture(width = 320, height = 180, fps = 8, quality = 0.55, maxBytes = 512000) {
  if (dmVideoStream) return;
  dmVideoStream = await navigator.mediaDevices.getUserMedia({
    video: { width, height, frameRate: fps },
    audio: false,
  });
  dmLocalVideoStreamStore.set(dmVideoStream);
  const videoEl = document.createElement('video');
  videoEl.srcObject = dmVideoStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const intervalMs = Math.max(100, Math.floor(1000 / fps));
  dmVideoTimer = window.setInterval(() => {
    if (!dmActiveThreadId || !dmVideoStream) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob || !dmActiveThreadId) return;
      blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf);
        if (bytes.byteLength > maxBytes) return;
        const targetThreadId = dmActiveThreadId;
        if (!targetThreadId) return;
        sendDmVideoFrame({
          threadId: targetThreadId,
          seq: dmSeq++,
          width,
          height,
          jpeg: bytes,
        }).catch(() => undefined);
      }).catch(() => undefined);
    }, 'image/jpeg', quality);
  }, intervalMs);
}

function stopDmVideoCapture() {
  if (dmVideoTimer) window.clearInterval(dmVideoTimer);
  if (dmVideoStream) dmVideoStream.getTracks().forEach((t) => t.stop());
  dmVideoTimer = null;
  dmVideoStream = null;
  dmLocalVideoStreamStore.set(null);
}

async function startDmScreenShare(quality: ScreenShareQuality = 'medium') {
  if (dmScreenStream) return;
  const preset = screenSharePresets[quality] ?? screenSharePresets.medium;
  dmScreenStream = await navigator.mediaDevices.getDisplayMedia({
    video: { width: preset.width, height: preset.height, frameRate: preset.fps },
    audio: false,
  });
  dmLocalVideoStreamStore.set(dmScreenStream);
  const track = dmScreenStream.getVideoTracks()[0];
  if (track) {
    track.onended = () => {
      stopDmScreenShare();
    };
  }
  const videoEl = document.createElement('video');
  videoEl.srcObject = dmScreenStream;
  videoEl.muted = true;
  videoEl.playsInline = true;
  await videoEl.play();
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const intervalMs = Math.max(100, Math.floor(1000 / preset.fps));
  dmScreenTimer = window.setInterval(() => {
    if (!dmActiveThreadId || !dmScreenStream) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob || !dmActiveThreadId) return;
      blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf);
        if (bytes.byteLength > preset.maxFrameBytes) return;
        const targetThreadId = dmActiveThreadId;
        if (!targetThreadId) return;
        sendDmVideoFrame({
          threadId: targetThreadId,
          seq: dmSeq++,
          width: preset.width,
          height: preset.height,
          jpeg: bytes,
        }).catch(() => undefined);
      }).catch(() => undefined);
    }, 'image/jpeg', preset.jpegQuality);
  }, intervalMs);
}

function stopDmScreenShare() {
  if (dmScreenTimer) window.clearInterval(dmScreenTimer);
  if (dmScreenStream) dmScreenStream.getTracks().forEach((t) => t.stop());
  dmScreenTimer = null;
  dmScreenStream = null;
  dmLocalVideoStreamStore.set(dmVideoStream ?? null);
  dmCallState.update((s) => ({ ...s, screenSharing: false }));
}

export async function joinDmVoice(threadId: bigint) {
  if (get(dmCallState).connecting) return;
  if (get(voiceState).joined || get(voiceState).connecting) {
    await leaveVoice();
  }
  dmCallState.update((s) => ({ ...s, connecting: true, error: null }));
  try {
    await joinDmCall(threadId);
    dmActiveThreadId = threadId;
    ensureDmEventHandlers();
    await startDmAudioCapture();
    playSfx('join');
    dmCallState.set({
      threadId,
      joined: true,
      connecting: false,
      error: null,
      videoEnabled: false,
      screenSharing: false,
    });
  } catch (e: any) {
    dmCallState.update((s) => ({ ...s, connecting: false, error: e?.message ?? String(e) }));
  }
}

export async function leaveDmVoice() {
  const threadId = dmActiveThreadId;
  dmActiveThreadId = null;
  stopDmAudioCapture();
  stopDmVideoCapture();
  stopDmScreenShare();
  dmPlaybackState.clear();
  dmCallState.set({
    threadId: null,
    joined: false,
    connecting: false,
    error: null,
    videoEnabled: false,
    screenSharing: false,
  });
  dmAudioLevelsStore.set({});
  dmRemoteVideoFramesStore.set({});
  for (const url of dmVideoUrlMap.values()) URL.revokeObjectURL(url);
  dmVideoUrlMap.clear();
  if (threadId) await leaveDmCall(threadId);
  playSfx('leave');
}

export async function setDmVideoEnabled(enable: boolean) {
  if (!dmActiveThreadId) return;
  if (enable) {
    stopDmScreenShare();
    await startDmVideoCapture();
  } else {
    stopDmVideoCapture();
  }
  dmCallState.update((s) => ({ ...s, videoEnabled: enable }));
}

export async function setDmScreenShareEnabled(enable: boolean, quality: ScreenShareQuality = 'medium') {
  if (!dmActiveThreadId) return;
  if (enable) {
    stopDmVideoCapture();
    dmCallState.update((s) => ({ ...s, videoEnabled: false, error: null }));
    try {
      await startDmScreenShare(quality);
      dmCallState.update((s) => ({ ...s, screenSharing: true }));
    } catch (e: any) {
      dmCallState.update((s) => ({ ...s, error: e?.message ?? String(e), screenSharing: false }));
      stopDmScreenShare();
    }
  } else {
    stopDmScreenShare();
  }
}
