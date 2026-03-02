import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import { DbConnection } from '../module_bindings';
import type { Identity } from 'spacetimedb';
import { initNotifications, sendNativeNotification } from './notifications';

export const connStore = writable<DbConnection | null>(null);
export const identityStore = writable<Identity | null>(null);
export const isConnected = writable(false);
export const isDataReady = writable(false);
export const connectionError = writable<string | null>(null);
export const actionError = writable<string | null>(null);

export const userAccountsStore = writable<any[]>([]);
export const userSessionsStore = writable<any[]>([]);
export const serversStore = writable<any[]>([]);
export const serverMembersStore = writable<any[]>([]);
export const inviteLinksStore = writable<any[]>([]);
export const categoriesStore = writable<any[]>([]);
export const channelsStore = writable<any[]>([]);
export const channelMessagesStore = writable<any[]>([]);
export const voiceMembersStore = writable<any[]>([]);
export const channelMediaSettingsStore = writable<any[]>([]);
export const dmThreadsStore = writable<any[]>([]);
export const dmMembersStore = writable<any[]>([]);
export const dmMessagesStore = writable<any[]>([]);
export const dmCallMembersStore = writable<any[]>([]);
export const fileUploadsStore = writable<any[]>([]);
export const messageReactionsStore = writable<any[]>([]);

export const currentUser = derived(
  [identityStore, userSessionsStore, userAccountsStore],
  ([$identity, $sessions, $accounts]) => {
    if (!$identity) return null;
    const myHex = $identity.toHexString();
    const session = $sessions.find(
      (s: any) => (s.identity?.toHexString?.() ?? '') === myHex
    );
    if (!session) return null;
    const userId = toBigIntId(session.userId ?? session.user_id);
    return $accounts.find((a: any) => toBigIntId(a.id) === userId) ?? null;
  }
);

export const isLoggedIn = derived(currentUser, ($u) => $u !== null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBigIntId(v: any): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'string') {
    try { return BigInt(v); } catch { return 0n; }
  }
  if (v && typeof v.toString === 'function') {
    try { return BigInt(v.toString()); } catch { return 0n; }
  }
  return 0n;
}

export function idEq(a: any, b: any): boolean {
  return toBigIntId(a) === toBigIntId(b);
}

export function identityHex(id: Identity | null | undefined): string {
  if (!id) return '';
  return id.toHexString();
}

function setActionError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  actionError.set(msg);
}

// ---------------------------------------------------------------------------
// Generic row helpers
// ---------------------------------------------------------------------------

function upsertById(arr: any[], row: any): any[] {
  const id = toBigIntId(row.id);
  const idx = arr.findIndex((r) => toBigIntId(r.id) === id);
  if (idx === -1) return [...arr, row];
  const copy = arr.slice();
  copy[idx] = row;
  return copy;
}

function removeById(arr: any[], row: any): any[] {
  const id = toBigIntId(row.id);
  return arr.filter((r) => toBigIntId(r.id) !== id);
}

function upsertByIdentity(arr: any[], row: any): any[] {
  const hex = row.identity?.toHexString?.() ?? '';
  const idx = arr.findIndex((r) => (r.identity?.toHexString?.() ?? '') === hex);
  if (idx === -1) return [...arr, row];
  const copy = arr.slice();
  copy[idx] = row;
  return copy;
}

function removeByIdentity(arr: any[], row: any): any[] {
  const hex = row.identity?.toHexString?.() ?? '';
  return arr.filter((r) => (r.identity?.toHexString?.() ?? '') !== hex);
}

function upsertByChannelId(arr: any[], row: any): any[] {
  const id = toBigIntId(row.channelId ?? row.channel_id);
  const idx = arr.findIndex((r) => toBigIntId(r.channelId ?? r.channel_id) === id);
  if (idx === -1) return [...arr, row];
  const copy = arr.slice();
  copy[idx] = row;
  return copy;
}

function removeByChannelId(arr: any[], row: any): any[] {
  const id = toBigIntId(row.channelId ?? row.channel_id);
  return arr.filter((r) => toBigIntId(r.channelId ?? r.channel_id) !== id);
}

function safe<T extends (...args: any[]) => any>(name: string, fn: T): T {
  return ((...args: any[]) => {
    try { return fn(...args); } catch (e) { console.error(`[stdb] ${name}`, e); }
  }) as T;
}

// ---------------------------------------------------------------------------
// Table accessor helpers
// ---------------------------------------------------------------------------

function getTable(conn: DbConnection, name: string) {
  const db: any = (conn as any).db;
  if (!db) return null;
  if (db[name]) return db[name];
  const camel = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (db[camel]) return db[camel];
  return null;
}

function getReducer(conn: DbConnection, snake: string) {
  const reducers: any = (conn as any).reducers;
  if (!reducers) return null;
  if (reducers[snake]) return reducers[snake];
  const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (reducers[camel]) return reducers[camel];
  return null;
}

function callReducer(conn: DbConnection, name: string, args: any) {
  const fn = getReducer(conn, name);
  if (!fn) {
    const msg = `Reducer not found: ${name}`;
    actionError.set(msg);
    throw new Error(msg);
  }
  actionError.set(null);
  try {
    const res = fn(args);
    if (res && typeof (res as any).then === 'function') {
      return (res as Promise<any>).catch((e: any) => { setActionError(e); throw e; });
    }
    return res;
  } catch (e) {
    setActionError(e);
    throw e;
  }
}

export function onEventInsert(tableName: string, handler: (row: any) => void) {
  const conn = get(connStore);
  if (!conn) return;
  const t = getTable(conn, tableName);
  if (!t) return;
  t.onInsert(safe(`${tableName}.evt`, (_e: any, row: any) => handler(row)));
}

// ---------------------------------------------------------------------------
// Row callbacks
// ---------------------------------------------------------------------------

function attachCallbacks(conn: DbConnection) {
  const bind = (
    tableName: string,
    store: any,
    upsert: (arr: any[], row: any) => any[],
    remove: (arr: any[], row: any) => any[]
  ) => {
    const t = getTable(conn, tableName);
    if (!t) return;
    t.onInsert(safe(`${tableName}.ins`, (_e: any, row: any) => store.update((a: any) => upsert((a ?? []) as any[], row))));
    t.onUpdate(safe(`${tableName}.upd`, (_e: any, _old: any, row: any) => store.update((a: any) => upsert((a ?? []) as any[], row))));
    t.onDelete(safe(`${tableName}.del`, (_e: any, row: any) => store.update((a: any) => remove((a ?? []) as any[], row))));
  };

  bind('user_account', userAccountsStore, upsertById, removeById);
  bind('user_session', userSessionsStore, upsertByIdentity, removeByIdentity);
  bind('server', serversStore, upsertById, removeById);
  bind('server_member', serverMembersStore, upsertById, removeById);
  bind('invite_link', inviteLinksStore, upsertById, removeById);
  bind('category', categoriesStore, upsertById, removeById);
  bind('channel', channelsStore, upsertById, removeById);
  bind('channel_message', channelMessagesStore, upsertById, removeById);
  bind('voice_member', voiceMembersStore, upsertById, removeById);
  bind('channel_media_settings', channelMediaSettingsStore, upsertByChannelId, removeByChannelId);
  bind('dm_thread', dmThreadsStore, upsertById, removeById);
  bind('dm_member', dmMembersStore, upsertById, removeById);
  bind('dm_message', dmMessagesStore, upsertById, removeById);
  bind('dm_call_member', dmCallMembersStore, upsertById, removeById);
  bind('file_upload', fileUploadsStore, upsertById, removeById);
  bind('message_reaction', messageReactionsStore, upsertById, removeById);

  // Native notifications for incoming messages (Tauri desktop only)
  const msgTable = getTable(conn, 'channel_message');
  if (msgTable) {
    msgTable.onInsert(safe('channel_message.notify', (_e: any, row: any) => {
      const myIdentity = get(identityStore);
      if (!myIdentity) return;
      const sessions = get(userSessionsStore);
      const mySession = sessions.find((s: any) => (s.identity?.toHexString?.() ?? '') === myIdentity.toHexString());
      if (!mySession) return;
      const myUserId = toBigIntId(mySession.userId ?? mySession.user_id);
      if (toBigIntId(row.senderId ?? row.sender_id) === myUserId) return;

      const users = get(userAccountsStore);
      const sender = users.find((u: any) => toBigIntId(u.id) === toBigIntId(row.senderId ?? row.sender_id));
      const senderName = sender?.displayName ?? sender?.display_name ?? sender?.username ?? 'Someone';
      const content = row.content ?? '';
      sendNativeNotification(senderName, content.length > 200 ? content.slice(0, 200) + '...' : content);
    }));
  }

  const dmTable = getTable(conn, 'dm_message');
  if (dmTable) {
    dmTable.onInsert(safe('dm_message.notify', (_e: any, row: any) => {
      const myIdentity = get(identityStore);
      if (!myIdentity) return;
      const sessions = get(userSessionsStore);
      const mySession = sessions.find((s: any) => (s.identity?.toHexString?.() ?? '') === myIdentity.toHexString());
      if (!mySession) return;
      const myUserId = toBigIntId(mySession.userId ?? mySession.user_id);
      if (toBigIntId(row.senderUserId ?? row.sender_user_id) === myUserId) return;

      const users = get(userAccountsStore);
      const sender = users.find((u: any) => toBigIntId(u.id) === toBigIntId(row.senderUserId ?? row.sender_user_id));
      const senderName = sender?.displayName ?? sender?.display_name ?? sender?.username ?? 'Someone';
      sendNativeNotification(senderName, 'Sent you a direct message');
    }));
  }
}

function loadInitialData(conn: DbConnection) {
  const load = (tableName: string, store: ReturnType<typeof writable>) => {
    const t = getTable(conn, tableName);
    if (t) store.set(Array.from(t.iter()));
  };
  load('user_account', userAccountsStore);
  load('user_session', userSessionsStore);
  load('server', serversStore);
  load('server_member', serverMembersStore);
  load('invite_link', inviteLinksStore);
  load('category', categoriesStore);
  load('channel', channelsStore);
  load('channel_message', channelMessagesStore);
  load('voice_member', voiceMembersStore);
  load('channel_media_settings', channelMediaSettingsStore);
  load('dm_thread', dmThreadsStore);
  load('dm_member', dmMembersStore);
  load('dm_message', dmMessagesStore);
  load('dm_call_member', dmCallMembersStore);
  load('file_upload', fileUploadsStore);
  load('message_reaction', messageReactionsStore);
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let started = false;

export function connectStdb() {
  if (!browser) return;
  if (started) return;
  started = true;
  isDataReady.set(false);

  const HOST = import.meta.env.VITE_SPACETIMEDB_URI as string | undefined;
  const DB = import.meta.env.VITE_SPACETIMEDB_DB as string | undefined;

  if (!HOST || !DB) {
    connectionError.set('Missing VITE_SPACETIMEDB_URI or VITE_SPACETIMEDB_DB');
    isDataReady.set(false);
    started = false;
    return;
  }

  const TOKEN_KEY = `${HOST}/${DB}/auth_token`;
  const savedToken = localStorage.getItem(TOKEN_KEY) ?? undefined;

  DbConnection.builder()
    .withUri(HOST)
    .withDatabaseName(DB)
    .withToken(savedToken || undefined)
    .onConnect((conn: DbConnection, identity: Identity, token: string) => {
      localStorage.setItem(TOKEN_KEY, token);
      connStore.set(conn);
      identityStore.set(identity);
      isConnected.set(true);
      connectionError.set(null);

      initNotifications();
      attachCallbacks(conn);

      try {
        conn
          .subscriptionBuilder()
          .onApplied(() => {
            loadInitialData(conn);
            isDataReady.set(true);
            connectionError.set(null);
          })
          .onError((_ctx: any) => {
            connectionError.set(`Subscription error: ${String(_ctx.event?.message ?? _ctx)}`);
          })
          .subscribeToAllTables();
      } catch (e) {
        connectionError.set(`Subscribe failed: ${String(e)}`);
      }
    })
    .onConnectError((_ctx: any, err: any) => {
      connectionError.set(String(err));
      isConnected.set(false);
      connStore.set(null);
      identityStore.set(null);
      isDataReady.set(false);
      started = false;
    })
    .onDisconnect((_ctx: any, err: any) => {
      isConnected.set(false);
      connStore.set(null);
      identityStore.set(null);
      isDataReady.set(false);
      if (err) connectionError.set(`Disconnected: ${String(err)}`);
      started = false;
    })
    .build();
}

// ---------------------------------------------------------------------------
// Reducer wrappers
// ---------------------------------------------------------------------------

export function register(email: string, password: string, username: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'register', { email, password, username }));
}

export function login(email: string, password: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'login', { email, password }));
}

export function logout() {
  const conn = get(connStore);
  if (!conn) return Promise.resolve();
  return Promise.resolve(callReducer(conn, 'logout', {}));
}

export function createServer(name: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'create_server', { name }));
}

export function deleteServer(serverId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'delete_server', { serverId }));
}

export function createInvite(serverId: bigint, maxUses: number = 0) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'create_invite', { serverId, maxUses }));
}

export function joinServer(inviteCode: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'join_server', { inviteCode }));
}

export function leaveServer(serverId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'leave_server', { serverId }));
}

export function createCategory(serverId: bigint, name: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'create_category', { serverId, name }));
}

export function deleteCategory(categoryId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'delete_category', { categoryId }));
}

export function createChannel(serverId: bigint, categoryId: bigint, name: string, channelType: { tag: string }) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'create_channel', { serverId, categoryId, name, channelType }));
}

export function deleteChannel(channelId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'delete_channel', { channelId }));
}

export function sendChannelMessage(channelId: bigint, content: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'send_channel_message', { channelId, content }));
}

export function deleteMessage(messageId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'delete_message', { messageId }));
}

export function joinVoiceChannel(channelId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'join_voice_channel', { channelId }));
}

export function leaveVoiceChannel(channelId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'leave_voice_channel', { channelId }));
}

export function kickFromVoice(channelId: bigint, targetUserId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'kick_from_voice', { channelId, targetUserId }));
}

export function updateVoiceState(payload: {
  channelId: bigint;
  muted: boolean;
  deafened: boolean;
  videoOn: boolean;
  screenSharing: boolean;
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'update_voice_state', payload));
}

export function setChannelMediaSettings(settings: {
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
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'set_channel_media_settings', settings));
}

export function sendAudioFrame(payload: {
  channelId: bigint;
  seq: number;
  sampleRate: number;
  channels: number;
  rms: number;
  pcm16le: Uint8Array;
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'send_audio_frame', payload));
}

export function sendVideoFrame(payload: {
  channelId: bigint;
  seq: number;
  width: number;
  height: number;
  jpeg: Uint8Array;
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'send_video_frame', payload));
}

export function setPublicEncryptionKey(publicEncryptionKey: Uint8Array) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'set_public_encryption_key', { publicEncryptionKey }));
}

export function openDmThread(targetUserId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'open_dm_thread', { targetUserId }));
}

export function sendDmMessage(payload: {
  threadId: bigint;
  receiverUserId: bigint;
  senderEphemeralPubkey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'send_dm_message', payload));
}

export function deleteDmMessage(messageId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'delete_dm_message', { messageId }));
}

export function joinDmCall(threadId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'join_dm_call', { threadId }));
}

export function leaveDmCall(threadId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'leave_dm_call', { threadId }));
}

export function sendDmAudioFrame(payload: {
  threadId: bigint;
  seq: number;
  sampleRate: number;
  channels: number;
  rms: number;
  pcm16le: Uint8Array;
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'send_dm_audio_frame', payload));
}

export function sendDmVideoFrame(payload: {
  threadId: bigint;
  seq: number;
  width: number;
  height: number;
  jpeg: Uint8Array;
}) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'send_dm_video_frame', payload));
}

export function updateProfile(displayName: string, status: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'update_profile', { displayName, status }));
}

export function updateAvatar(fileData: Uint8Array, contentType: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'update_avatar', { fileData, contentType }));
}

export function removeAvatar() {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'remove_avatar', {}));
}

export function updateBanner(fileData: Uint8Array, contentType: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'update_banner', { fileData, contentType }));
}

export function removeBanner() {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'remove_banner', {}));
}

export function uploadFile(filename: string, contentType: string, data: Uint8Array) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'upload_file', { filename, contentType, data }));
}

export function addReaction(messageId: bigint, emoji: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'add_reaction', { messageId, emoji }));
}

export function removeReaction(messageId: bigint, emoji: string) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'remove_reaction', { messageId, emoji }));
}

export function deleteFile(fileId: bigint) {
  const conn = get(connStore);
  if (!conn) return Promise.reject(new Error('Not connected'));
  return Promise.resolve(callReducer(conn, 'delete_file', { fileId }));
}

export function getFileDataUrl(fileId: any, files: any[]): string | null {
  const fid = toBigIntId(fileId);
  if (fid === 0n) return null;
  const file = files.find((f: any) => toBigIntId(f.id) === fid);
  if (!file) return null;
  const ct = file.contentType ?? file.content_type ?? 'application/octet-stream';
  const data = file.data;
  if (!data || data.length === 0) return null;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${ct};base64,${btoa(binary)}`;
}

export function getMyDmThreads(userId: any, threads: any[], members: any[]) {
  const uid = toBigIntId(userId);
  const myThreadIds = new Set(
    members
      .filter((m: any) => toBigIntId(m.userId ?? m.user_id) === uid)
      .map((m: any) => toBigIntId(m.threadId ?? m.thread_id).toString())
  );
  return threads
    .filter((t: any) => myThreadIds.has(toBigIntId(t.id).toString()))
    .sort((a: any, b: any) => {
      const at = Number(toBigIntId(a.lastMessageAt ?? a.last_message_at));
      const bt = Number(toBigIntId(b.lastMessageAt ?? b.last_message_at));
      return bt - at;
    });
}

export function getOtherDmParticipant(threadId: any, myUserId: any, members: any[], users: any[]) {
  const tid = toBigIntId(threadId);
  const mine = toBigIntId(myUserId);
  const otherMember = members.find((m: any) =>
    toBigIntId(m.threadId ?? m.thread_id) === tid && toBigIntId(m.userId ?? m.user_id) !== mine
  );
  if (!otherMember) return null;
  const otherId = toBigIntId(otherMember.userId ?? otherMember.user_id);
  return users.find((u: any) => toBigIntId(u.id) === otherId) ?? null;
}
