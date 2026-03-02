<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import {
    currentUser, channelsStore, channelMessagesStore, userAccountsStore,
    serverMembersStore, userSessionsStore, idEq, sendChannelMessage, deleteMessage, openDmThread, dmThreadsStore,
    voiceMembersStore, channelMediaSettingsStore, setChannelMediaSettings, kickFromVoice,
    messageReactionsStore, addReaction, removeReaction
  } from '$lib/stdb';
  import {
    joinVoice, leaveVoice, setVideoEnabled, setScreenShareEnabled,
    voiceState, audioLevelsStore, remoteVideoFramesStore, localVideoStreamStore,
    audioControlStore, setInputGain, setOutputGain, toggleMute, toggleDeafen
  } from '$lib/voice';
  import { mobileNavOpen, mobileMembersOpen } from '$lib/mobile-nav';
  import MessageContent from '$lib/components/MessageContent.svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import EmojiPicker from '$lib/components/EmojiPicker.svelte';

  let messageText = $state('');
  let messagesEl: HTMLDivElement | null = $state(null);
  let lastScrollKey = $state('');
  let localVideoEl: HTMLVideoElement | null = $state(null);

  let showSettings = $state(false);
  let settingsSaving = $state(false);
  let settingsError = $state('');

  let audioTargetSampleRate = $state(16000);
  let audioFrameMs = $state(50);
  let audioMaxFrameBytes = $state(64000);
  let audioBitrateKbps = $state(64);
  let audioTalkingRmsThreshold = $state(0.02);
  let videoEnabled = $state(false);
  let videoWidth = $state(320);
  let videoHeight = $state(180);
  let videoFps = $state(5);
  let videoJpegQuality = $state(0.55);
  let videoMaxFrameBytes = $state(512000);
  type ScreenShareQuality = 'low' | 'medium' | 'high';
  let screenShareQuality = $state<ScreenShareQuality>('medium');

  let serverId = $derived($page.params.serverId);
  let channelId = $derived($page.params.channelId);
  let channelIdBig = $derived(BigInt(channelId || '0'));
  let serverIdBig = $derived(BigInt(serverId || '0'));

  const lastChannelKey = (sid: string) => `last_channel:${sid}`;

  let channel = $derived(($channelsStore ?? []).find((c: any) => idEq(c.id, channelIdBig)) ?? null);
  let isVoiceChannel = $derived(channel ? channelTypeTag(channel) === 'voice' : false);

  let messages = $derived(($channelMessagesStore ?? [])
    .filter((m: any) => idEq(m.channelId ?? m.channel_id, channelIdBig))
    .sort((a: any, b: any) => {
      const ai = BigInt(a.id?.toString?.() ?? '0');
      const bi = BigInt(b.id?.toString?.() ?? '0');
      if (ai < bi) return -1;
      if (ai > bi) return 1;
      return 0;
    }));

  let serverMembers = $derived(($serverMembersStore ?? [])
    .filter((m: any) => idEq(m.serverId ?? m.server_id, serverIdBig)));
  let voiceMembers = $derived(($voiceMembersStore ?? [])
    .filter((m: any) => idEq(m.channelId ?? m.channel_id, channelIdBig)));

  let channelSettings = $derived((($channelMediaSettingsStore ?? [])
    .find((s: any) => idEq(s.channelId ?? s.channel_id, channelIdBig))) ?? null);

  let presenceNow = $state(Date.now());

  function getUser(userId: any) {
    return ($userAccountsStore ?? []).find((u: any) => idEq(u.id, userId)) ?? null;
  }

  function idKey(id: any): string {
    if (id === null || id === undefined) return '';
    if (typeof id === 'bigint') return id.toString();
    return id?.toString?.() ?? String(id);
  }

  function timestampToMs(ts: any): number {
    if (!ts) return 0;
    try {
      const v = typeof ts === 'bigint' ? Number(ts / 1000n) : Number(ts) / 1000;
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }

  let onlineUserIds = $derived(new Set(($userSessionsStore ?? [])
    .map((s: any) => idKey(s.userId ?? s.user_id))));

  let lastActiveByUser = $derived((() => {
    const map = new Map<string, number>();
    for (const session of ($userSessionsStore ?? [])) {
      const key = idKey(session.userId ?? session.user_id);
      const ts = timestampToMs(session.connectedAt ?? session.connected_at);
      if (key) map.set(key, Math.max(map.get(key) ?? 0, ts));
    }
    for (const msg of ($channelMessagesStore ?? [])) {
      const key = idKey(msg.senderId ?? msg.sender_id);
      const ts = timestampToMs(msg.sentAt ?? msg.sent_at);
      if (key) map.set(key, Math.max(map.get(key) ?? 0, ts));
    }
    for (const vm of ($voiceMembersStore ?? [])) {
      const key = idKey(vm.userId ?? vm.user_id);
      const ts = timestampToMs(vm.joinedAt ?? vm.joined_at);
      if (key) map.set(key, Math.max(map.get(key) ?? 0, ts));
    }
    return map;
  })());

  function isUserInVoice(userId: any): boolean {
    const key = idKey(userId);
    if (!key) return false;
    const channels = $channelsStore ?? [];
    for (const vm of ($voiceMembersStore ?? [])) {
      if (idKey(vm.userId ?? vm.user_id) !== key) continue;
      const chId = vm.channelId ?? vm.channel_id;
      const ch = channels.find((c: any) => idEq(c.id, chId));
      if (ch && idEq(ch.serverId ?? ch.server_id, serverIdBig)) return true;
    }
    return false;
  }

  function getUserStatus(userId: any): 'online' | 'away' | 'dnd' | 'offline' {
    const key = idKey(userId);
    if (!key || !onlineUserIds.has(key)) return 'offline';
    if (isUserInVoice(userId)) return 'dnd';
    const lastActive = lastActiveByUser.get(key) ?? 0;
    if (lastActive && (presenceNow - lastActive) > 10 * 60 * 1000) return 'away';
    return 'online';
  }

  function statusColor(status: 'online' | 'away' | 'dnd' | 'offline'): string {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'away': return 'bg-yellow-400';
      case 'dnd': return 'bg-red-400';
      default: return 'bg-[#5c6370]';
    }
  }

  function getMemberRole(member: any): string {
    const r = member?.role;
    if (!r) return 'Member';
    if (typeof r === 'string') return r;
    if (r.tag) return r.tag;
    const keys = Object.keys(r);
    return keys.length ? keys[0] : 'Member';
  }

  function channelTypeTag(ch: any): string {
    const ct = ch?.channelType ?? ch?.channel_type;
    if (!ct) return 'text';
    if (typeof ct === 'string') return ct.toLowerCase();
    if (ct.tag) return ct.tag.toLowerCase();
    const keys = Object.keys(ct);
    return keys.length ? keys[0].toLowerCase() : 'text';
  }

  let myMembership = $derived(($serverMembersStore ?? [])
    .find((m: any) => idEq(m.serverId ?? m.server_id, serverIdBig) && idEq(m.userId ?? m.user_id, $currentUser?.id)));
  let myRole = $derived(myMembership ? (myMembership.role?.tag ?? myMembership.role) : null);
  let isAdmin = $derived(myRole === 'Owner' || myRole === 'Admin');
  let isInVoice = $derived($voiceState.joined && $voiceState.channelId && idEq($voiceState.channelId, channelIdBig));

  function formatTime(ts: any): string {
    if (!ts) return '';
    try {
      const d = new Date(typeof ts === 'bigint' ? Number(ts / 1000n) : Number(ts) / 1000);
      if (isNaN(d.getTime())) return '';
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return 'Today at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  $effect(() => {
    if (localVideoEl) {
      const stream = $localVideoStreamStore;
      localVideoEl.srcObject = stream ?? null;
      if (stream) localVideoEl.play().catch(() => undefined);
    }
  });

  $effect(() => {
    if (!browser || !serverId || !channelId) return;
    try {
      localStorage.setItem(lastChannelKey(serverId), channelId);
      const url = new URL(window.location.href);
      const targetPath = `/channels/${serverId}`;
      if (url.pathname !== targetPath) {
        url.pathname = targetPath;
        window.history.replaceState(window.history.state, '', url.toString());
      }
    } catch {
      /* ignore storage/history errors */
    }
  });

  $effect(() => {
    if (!browser) return;
    const id = window.setInterval(() => {
      presenceNow = Date.now();
    }, 30000);
    return () => window.clearInterval(id);
  });

  $effect(() => {
    if (!channelSettings) return;
    audioTargetSampleRate = Number(channelSettings.audioTargetSampleRate ?? channelSettings.audio_target_sample_rate ?? 16000);
    audioFrameMs = Number(channelSettings.audioFrameMs ?? channelSettings.audio_frame_ms ?? 50);
    audioMaxFrameBytes = Number(channelSettings.audioMaxFrameBytes ?? channelSettings.audio_max_frame_bytes ?? 64000);
    audioBitrateKbps = Number(channelSettings.audioBitrateKbps ?? channelSettings.audio_bitrate_kbps ?? 64);
    audioTalkingRmsThreshold = Number(channelSettings.audioTalkingRmsThreshold ?? channelSettings.audio_talking_rms_threshold ?? 0.02);
    videoEnabled = Boolean(channelSettings.videoEnabled ?? channelSettings.video_enabled ?? false);
    videoWidth = Number(channelSettings.videoWidth ?? channelSettings.video_width ?? 320);
    videoHeight = Number(channelSettings.videoHeight ?? channelSettings.video_height ?? 180);
    videoFps = Number(channelSettings.videoFps ?? channelSettings.video_fps ?? 5);
    videoJpegQuality = Number(channelSettings.videoJpegQuality ?? channelSettings.video_jpeg_quality ?? 0.55);
    videoMaxFrameBytes = Number(channelSettings.videoMaxFrameBytes ?? channelSettings.video_max_frame_bytes ?? 512000);
  });

  async function handleSend() {
    const text = messageText.trim();
    if (!text) return;
    messageText = '';
    try {
      await sendChannelMessage(channelIdBig, text);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleJoinVoice() {
    await joinVoice(channelIdBig, { video: false });
  }

  async function handleLeaveVoice() {
    await leaveVoice();
  }

  async function handleToggleVideo() {
    await setVideoEnabled(!$voiceState.videoEnabled);
  }

  async function handleToggleScreenShare() {
    if ($voiceState.screenSharing) {
      await setScreenShareEnabled(false);
    } else {
      await setScreenShareEnabled(true, screenShareQuality);
    }
  }

  async function handleSaveSettings() {
    settingsError = '';
    settingsSaving = true;
    try {
      await setChannelMediaSettings({
        channelId: channelIdBig,
        audioTargetSampleRate,
        audioFrameMs,
        audioMaxFrameBytes,
        audioBitrateKbps,
        audioTalkingRmsThreshold,
        videoEnabled,
        videoWidth,
        videoHeight,
        videoFps,
        videoJpegQuality,
        videoMaxFrameBytes,
      });
      showSettings = false;
    } catch (e: any) {
      settingsError = e?.message ?? String(e);
    } finally {
      settingsSaving = false;
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleDelete(msgId: any) {
    try {
      await deleteMessage(BigInt(msgId?.toString?.() ?? '0'));
    } catch (e) { console.error(e); }
  }

  async function handleStartDm(userId: any) {
    if (!$currentUser || idEq($currentUser.id, userId)) return;
    const targetId = BigInt(userId?.toString?.() ?? '0');
    await openDmThread(targetId);
    await tick();
    const myId = BigInt($currentUser.id?.toString?.() ?? '0');
    const low = myId < targetId ? myId : targetId;
    const high = myId < targetId ? targetId : myId;
    const pairKey = `${low.toString()}:${high.toString()}`;
    const thread = ($dmThreadsStore ?? []).find((t: any) => (t.pairKey ?? t.pair_key) === pairKey);
    if (thread?.id) {
      goto(`/dm/${thread.id}`);
    }
  }

  $effect(() => {
    const key = messages.length ? messages[messages.length - 1]?.id?.toString?.() ?? '' : '';
    if (messagesEl && key && key !== lastScrollKey) {
      lastScrollKey = key;
      tick().then(() => {
        if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  });

  // Context menu state
  let ctxMenu = $state({ visible: false, x: 0, y: 0, items: [] as any[] });
  let emojiPicker = $state({ visible: false, x: 0, y: 0, messageId: null as any });

  function closeContextMenu() {
    ctxMenu = { visible: false, x: 0, y: 0, items: [] };
  }
  function closeEmojiPicker() {
    emojiPicker = { visible: false, x: 0, y: 0, messageId: null };
  }

  function handleMessageContext(e: MouseEvent, msg: any) {
    e.preventDefault();
    closeEmojiPicker();
    const sender = getUser(msg.senderId ?? msg.sender_id);
    const isOwn = $currentUser && idEq(msg.senderId ?? msg.sender_id, $currentUser.id);
    const items: any[] = [
      {
        label: 'Add Reaction',
        icon: '😀',
        action: () => {
          emojiPicker = { visible: true, x: e.clientX, y: e.clientY, messageId: msg.id };
        }
      },
      {
        label: 'Copy Message',
        icon: '📋',
        action: () => {
          navigator.clipboard.writeText(msg.content ?? '').catch(() => {});
        }
      },
    ];
    if (sender && $currentUser && !idEq(sender.id, $currentUser.id)) {
      items.push({
        label: `Message ${sender.displayName ?? sender.display_name ?? sender.username ?? 'User'}`,
        icon: '💬',
        action: () => handleStartDm(sender.id),
      });
    }
    if (isOwn || isAdmin) {
      items.push(
        { separator: true, label: '', action: () => {} },
        {
          label: 'Delete Message',
          icon: '🗑️',
          danger: true,
          action: () => handleDelete(msg.id),
        }
      );
    }
    ctxMenu = { visible: true, x: e.clientX, y: e.clientY, items };
  }

  function handleUserContext(e: MouseEvent, user: any) {
    e.preventDefault();
    closeEmojiPicker();
    if (!user) return;
    const items: any[] = [];
    if ($currentUser && !idEq(user.id, $currentUser.id)) {
      items.push({
        label: `Message ${user.displayName ?? user.display_name ?? user.username ?? 'User'}`,
        icon: '💬',
        action: () => handleStartDm(user.id),
      });
    }
    items.push({
      label: 'Copy Username',
      icon: '📋',
      action: () => {
        navigator.clipboard.writeText(user.username ?? '').catch(() => {});
      }
    });
    if (items.length === 0) return;
    ctxMenu = { visible: true, x: e.clientX, y: e.clientY, items };
  }

  async function handleEmojiSelect(emoji: string) {
    if (!emojiPicker.messageId) return;
    const msgId = BigInt(emojiPicker.messageId?.toString?.() ?? '0');
    try {
      await addReaction(msgId, emoji);
    } catch (e) { console.error(e); }
  }

  async function handleToggleReaction(msgId: any, emoji: string) {
    const id = BigInt(msgId?.toString?.() ?? '0');
    const myId = $currentUser?.id;
    if (!myId) return;
    const existing = ($messageReactionsStore ?? []).find(
      (r: any) => idEq(r.messageId ?? r.message_id, id) && idEq(r.userId ?? r.user_id, myId) && (r.emoji === emoji)
    );
    try {
      if (existing) {
        await removeReaction(id, emoji);
      } else {
        await addReaction(id, emoji);
      }
    } catch (e) { console.error(e); }
  }

  function getReactionsForMessage(msgId: any) {
    const id = BigInt(msgId?.toString?.() ?? '0');
    const reactions = ($messageReactionsStore ?? []).filter(
      (r: any) => idEq(r.messageId ?? r.message_id, id)
    );
    const grouped = new Map<string, { emoji: string; count: number; userIds: Set<string> }>();
    for (const r of reactions) {
      const e = r.emoji;
      if (!grouped.has(e)) grouped.set(e, { emoji: e, count: 0, userIds: new Set() });
      const g = grouped.get(e)!;
      g.count++;
      g.userIds.add((r.userId ?? r.user_id)?.toString?.() ?? '');
    }
    return Array.from(grouped.values());
  }

  function hasMyReaction(group: { emoji: string; userIds: Set<string> }) {
    const myId = $currentUser?.id?.toString?.() ?? '';
    return myId && group.userIds.has(myId);
  }

  let membersByRole = $derived((() => {
    const groups: Record<string, any[]> = { Owner: [], Admin: [], Member: [] };
    for (const m of serverMembers) {
      const role = getMemberRole(m);
      const user = getUser(m.userId ?? m.user_id);
      if (!user) continue;
      if (!groups[role]) groups[role] = [];
      groups[role].push({ ...m, user });
    }
    return groups;
  })());
</script>

{#snippet memberListContent()}
  {#each Object.entries(membersByRole) as [role, members]}
    {#if members.length > 0}
      <div class="mb-4">
        <h4 class="text-xs font-semibold text-[#8b95a8] uppercase tracking-wide px-2 mb-2">
          {role} — {members.length}
        </h4>
        {#each members as m (m.id?.toString?.())}
          {@const status = getUserStatus(m.user?.id ?? m.userId ?? m.user_id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1b2230]/50 transition-colors"
            oncontextmenu={(e) => handleUserContext(e, m.user)}
          >
            <div class="relative flex-shrink-0">
              <UserAvatar user={m.user} size="sm" />
              <span
                class={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0f121a] ${statusColor(status)}`}
                title={status === 'dnd' ? 'Do not disturb' : status[0].toUpperCase() + status.slice(1)}
              ></span>
            </div>
            <div class="min-w-0">
              <div class="text-sm text-[#e9eefc] truncate">{m.user?.displayName ?? m.user?.display_name ?? m.user?.username ?? 'Unknown'}</div>
              {#if m.user?.status}
                <div class="text-xs text-[#8b95a8] truncate">{m.user.status}</div>
              {/if}
            </div>
            {#if !idEq(m.user?.id, $currentUser?.id)}
              <button
                onclick={() => handleStartDm(m.user?.id)}
                class="ml-auto text-[11px] text-[#8b95a8] hover:text-[#e9eefc] px-2 py-1 rounded-md hover:bg-[#1b2230] flex-shrink-0"
                title="Start direct message"
              >
                Message
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/each}
{/snippet}

<!-- Chat area -->
<div class="flex-1 flex flex-col min-w-0 bg-[#0f121a]">
  <!-- Channel header -->
  <div class="h-12 px-3 md:px-4 flex items-center gap-2 border-b border-[#1b2230] flex-shrink-0">
    <!-- Mobile hamburger -->
    <button onclick={() => $mobileNavOpen = true} class="md:hidden p-1.5 -ml-1 text-[#8b95a8] hover:text-[#e9eefc] rounded-md hover:bg-[#1b2230]/50 transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
    <svg class="w-5 h-5 text-[#8b95a8] flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
    </svg>
    <h3 class="font-semibold text-[#e9eefc] truncate">{channel?.name ?? 'unknown'}</h3>
    <div class="flex-1"></div>
    <!-- Mobile members toggle -->
    <button onclick={() => $mobileMembersOpen = true} class="md:hidden p-1.5 text-[#8b95a8] hover:text-[#e9eefc] rounded-md hover:bg-[#1b2230]/50 transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2m22 4v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    </button>
  </div>

  {#if isVoiceChannel}
    <div class="border-b border-[#1b2230] p-3 md:p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 md:gap-4">
        <div>
          <div class="text-sm font-semibold text-[#e9eefc]">Voice Channel</div>
          <div class="text-xs text-[#8b95a8]">{voiceMembers.length} in voice</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          {#if !isInVoice}
            <button
              onclick={handleJoinVoice}
              disabled={$voiceState.connecting}
              class="px-3 py-1.5 text-sm bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white rounded-md"
            >
              {$voiceState.connecting ? 'Joining...' : 'Join Voice'}
            </button>
          {:else}
            <button
              onclick={handleLeaveVoice}
              class="px-3 py-1.5 text-sm bg-[#1b2230] hover:bg-[#263146] text-[#e9eefc] rounded-md"
            >
              Leave Voice
            </button>
            <button
              onclick={handleToggleVideo}
              disabled={!videoEnabled || $voiceState.screenSharing}
              class="px-3 py-1.5 text-sm bg-[#1b2230] hover:bg-[#263146] disabled:opacity-50 text-[#e9eefc] rounded-md"
              title={!videoEnabled ? 'Video disabled for this channel' : ($voiceState.screenSharing ? 'Stop screen share to start video' : '')}
            >
              {$voiceState.videoEnabled ? 'Stop Video' : 'Start Video'}
            </button>
            <div class="flex items-center gap-2">
              <button
                onclick={handleToggleScreenShare}
                class="px-3 py-1.5 text-sm bg-[#1b2230] hover:bg-[#263146] text-[#e9eefc] rounded-md"
              >
                {$voiceState.screenSharing ? 'Stop Share' : 'Share Screen'}
              </button>
              {#if !$voiceState.screenSharing}
                <select
                  bind:value={screenShareQuality}
                  class="bg-[#0b0d12] border border-[#1b2230] text-[#e9eefc] text-sm rounded-md px-2 py-1.5"
                  title="Screen share quality"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              {/if}
            </div>
          {/if}
          {#if isAdmin}
            <button
              onclick={() => showSettings = !showSettings}
              class="px-3 py-1.5 text-sm bg-transparent border border-[#1b2230] hover:border-[#2a354a] text-[#8b95a8] rounded-md"
            >
              Settings
            </button>
          {/if}
        </div>
      </div>

      {#if $voiceState.error}
        <p class="text-xs text-red-400 mt-2">{$voiceState.error}</p>
      {/if}

      <div class="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
        {#if voiceMembers.length === 0}
          <div class="text-sm text-[#8b95a8]">No one is in voice yet.</div>
        {:else}
          {#each voiceMembers as m (m.id?.toString?.())}
            {@const user = getUser(m.userId ?? m.user_id)}
            {@const hex = m.identity?.toHexString?.() ?? ''}
            {@const level = $audioLevelsStore?.[hex]}
            {@const speaking = level && level.rms >= audioTalkingRmsThreshold && (Date.now() - level.at) < 1500}
            {@const isMe = $currentUser && idEq(m.userId ?? m.user_id, $currentUser.id)}
            <div class="flex items-center gap-2 px-2 py-1.5 bg-[#0b0d12] rounded-md group">
              <div class="w-2 h-2 rounded-full flex-shrink-0 {speaking ? 'bg-green-400' : 'bg-[#1b2230]'}"></div>
              <div class="text-sm text-[#e9eefc] truncate flex-1">{user?.displayName ?? user?.display_name ?? user?.username ?? 'Unknown'}</div>
              {#if isAdmin && !isMe}
                <button
                  onclick={() => kickFromVoice(channelIdBig, BigInt((m.userId ?? m.user_id)?.toString?.() ?? '0')).catch(() => {})}
                  class="hidden group-hover:block flex-shrink-0 text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-900/20"
                  title="Kick from voice"
                >
                  Kick
                </button>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      {#if isInVoice}
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button
            onclick={toggleMute}
            class="px-3 py-1.5 text-sm rounded-md {($audioControlStore.muted ? 'bg-red-900/30 text-red-300' : 'bg-[#1b2230] text-[#e9eefc]')}"
          >
            {$audioControlStore.muted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onclick={toggleDeafen}
            class="px-3 py-1.5 text-sm rounded-md {($audioControlStore.deafened ? 'bg-red-900/30 text-red-300' : 'bg-[#1b2230] text-[#e9eefc]')}"
          >
            {$audioControlStore.deafened ? 'Undeafen' : 'Deafen'}
          </button>

          <div class="flex items-center gap-2">
            <span class="text-xs text-[#8b95a8]">Input</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={$audioControlStore.inputGain}
              oninput={(e) => setInputGain(Number((e.currentTarget as HTMLInputElement).value))}
              class="w-20 md:w-auto"
            />
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-[#8b95a8]">Output</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={$audioControlStore.outputGain}
              oninput={(e) => setOutputGain(Number((e.currentTarget as HTMLInputElement).value))}
              class="w-20 md:w-auto"
            />
          </div>
        </div>
      {/if}

      {#if $voiceState.videoEnabled || $voiceState.screenSharing || Object.keys($remoteVideoFramesStore ?? {}).length}
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {#if $voiceState.videoEnabled || $voiceState.screenSharing}
            <div class="rounded-lg overflow-hidden bg-[#0b0d12] border border-[#1b2230]">
              <video bind:this={localVideoEl} autoplay playsinline muted class="w-full h-36 object-cover"></video>
              <div class="px-2 py-1 text-xs text-[#8b95a8]">
                You{$voiceState.screenSharing ? ' (Screen)' : ''}
              </div>
            </div>
          {/if}
          {#each Object.entries($remoteVideoFramesStore ?? {}) as [id, url]}
            <div class="rounded-lg overflow-hidden bg-[#0b0d12] border border-[#1b2230]">
              <img src={url} alt="Video stream" class="w-full h-36 object-cover" />
            </div>
          {/each}
        </div>
      {/if}

      {#if showSettings}
        <div class="mt-4 p-4 bg-[#0b0d12] border border-[#1b2230] rounded-lg">
          <h4 class="text-sm font-semibold text-[#e9eefc] mb-3">Voice Settings</h4>
          <form onsubmit={(e) => { e.preventDefault(); handleSaveSettings(); }} class="space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Sample Rate</label>
                <input type="number" bind:value={audioTargetSampleRate} min="8000" max="48000" step="1000"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Frame (ms)</label>
                <input type="number" bind:value={audioFrameMs} min="10" max="100" step="5"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Max Frame Bytes</label>
                <input type="number" bind:value={audioMaxFrameBytes} min="256" max="256000" step="256"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Bitrate (kbps)</label>
                <input type="number" bind:value={audioBitrateKbps} min="8" max="512" step="8"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Talking RMS</label>
                <input type="number" bind:value={audioTalkingRmsThreshold} min="0" max="1" step="0.01"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div class="flex items-center gap-2 mt-5">
                <input id="videoEnabled" type="checkbox" bind:checked={videoEnabled} class="accent-[#5865f2]" />
                <label for="videoEnabled" class="text-xs text-[#8b95a8]">Enable Video</label>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Video Width</label>
                <input type="number" bind:value={videoWidth} min="160" max="1280" step="10"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Video Height</label>
                <input type="number" bind:value={videoHeight} min="120" max="720" step="10"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Video FPS</label>
                <input type="number" bind:value={videoFps} min="1" max="30" step="1"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">JPEG Quality</label>
                <input type="number" bind:value={videoJpegQuality} min="0.05" max="1" step="0.05"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
              <div>
                <label class="block text-xs text-[#8b95a8] mb-1">Video Max Bytes</label>
                <input type="number" bind:value={videoMaxFrameBytes} min="1024" max="2000000" step="1024"
                  class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-md px-2 py-1.5" />
              </div>
            </div>

            {#if settingsError}
              <p class="text-xs text-red-400">{settingsError}</p>
            {/if}

            <div class="flex justify-end gap-2">
              <button type="button" onclick={() => showSettings = false}
                class="px-3 py-1.5 text-sm text-[#8b95a8] hover:text-[#e9eefc]">
                Cancel
              </button>
              <button type="submit" disabled={settingsSaving}
                class="px-3 py-1.5 text-sm bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white rounded-md">
                {settingsSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Messages -->
  <div
    bind:this={messagesEl}
    class="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-1"
  >
    {#if messages.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-center px-4">
        <div class="w-16 h-16 rounded-full bg-[#1b2230] flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-[#8b95a8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
          </svg>
        </div>
        <h3 class="text-xl font-bold text-[#e9eefc] mb-1">Welcome to #{channel?.name ?? 'channel'}!</h3>
        <p class="text-[#8b95a8] text-sm">This is the start of the channel.</p>
      </div>
    {:else}
      {#each messages as msg, i (msg.id?.toString?.())}
        {@const sender = getUser(msg.senderId ?? msg.sender_id)}
        {@const prevMsg = i > 0 ? messages[i - 1] : null}
        {@const sameSender = prevMsg && idEq(prevMsg.senderId ?? prevMsg.sender_id, msg.senderId ?? msg.sender_id)}
        {@const isOwn = $currentUser && idEq(msg.senderId ?? msg.sender_id, $currentUser.id)}

        {@const reactions = getReactionsForMessage(msg.id)}
        {#if !sameSender}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-start gap-3 pt-3 group hover:bg-[#1b2230]/30 px-2 -mx-2 rounded-md"
            oncontextmenu={(e) => handleMessageContext(e, msg)}
          >
            <div class="mt-0.5" oncontextmenu={(e) => { e.stopPropagation(); handleUserContext(e, sender); }}>
              <UserAvatar user={sender} size="md" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-2 flex-wrap">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="font-semibold text-[#e9eefc] text-sm cursor-pointer hover:underline"
                  oncontextmenu={(e) => { e.stopPropagation(); handleUserContext(e, sender); }}
                >{sender?.displayName ?? sender?.display_name ?? sender?.username ?? 'Unknown'}</span>
                <span class="text-xs text-[#8b95a8]">{formatTime(msg.sentAt ?? msg.sent_at)}</span>
                {#if isOwn}
                  <button
                    onclick={() => handleDelete(msg.id)}
                    class="md:opacity-0 md:group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 ml-auto transition-opacity"
                  >
                    Delete
                  </button>
                {/if}
              </div>
              <MessageContent text={msg.content} />
              {#if reactions.length > 0}
                <div class="flex flex-wrap gap-1 mt-1">
                  {#each reactions as rg (rg.emoji)}
                    <button
                      onclick={() => handleToggleReaction(msg.id, rg.emoji)}
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-colors
                        {hasMyReaction(rg) ? 'bg-[#5865f2]/20 border-[#5865f2]/50 text-[#e9eefc]' : 'bg-[#1b2230]/50 border-[#1b2230] text-[#8b95a8] hover:border-[#5865f2]/30'}"
                    >
                      <span class="text-sm">{rg.emoji}</span>
                      <span>{rg.count}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {:else}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="flex items-start gap-3 group hover:bg-[#1b2230]/30 px-2 -mx-2 rounded-md"
            oncontextmenu={(e) => handleMessageContext(e, msg)}
          >
            <div class="w-8 md:w-10 flex-shrink-0"></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start gap-2">
                <div class="flex-1"><MessageContent text={msg.content} /></div>
                {#if isOwn}
                  <button
                    onclick={() => handleDelete(msg.id)}
                    class="md:opacity-0 md:group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 flex-shrink-0 transition-opacity"
                  >
                    Delete
                  </button>
                {/if}
              </div>
              {#if reactions.length > 0}
                <div class="flex flex-wrap gap-1 mt-1">
                  {#each reactions as rg (rg.emoji)}
                    <button
                      onclick={() => handleToggleReaction(msg.id, rg.emoji)}
                      class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-colors
                        {hasMyReaction(rg) ? 'bg-[#5865f2]/20 border-[#5865f2]/50 text-[#e9eefc]' : 'bg-[#1b2230]/50 border-[#1b2230] text-[#8b95a8] hover:border-[#5865f2]/30'}"
                    >
                      <span class="text-sm">{rg.emoji}</span>
                      <span>{rg.count}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- Message composer -->
  <div class="px-3 md:px-4 pb-3 md:pb-4 flex-shrink-0">
    <div class="flex items-center bg-[#1b2230] rounded-xl px-3 md:px-4">
      <input
        type="text"
        bind:value={messageText}
        onkeydown={onKeyDown}
        placeholder="Message #{channel?.name ?? 'channel'}"
        class="flex-1 bg-transparent text-[#e9eefc] py-3 outline-none placeholder-[#8b95a8] text-sm min-w-0"
      />
      <button
        onclick={handleSend}
        disabled={!messageText.trim()}
        aria-label="Send message"
        class="ml-2 text-[#8b95a8] hover:text-[#e9eefc] disabled:opacity-30 transition-colors flex-shrink-0"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  </div>
</div>

<!-- Desktop member list (right sidebar) -->
<div class="hidden md:block w-60 flex-shrink-0 bg-[#0f121a] border-l border-[#1b2230] overflow-y-auto py-4 px-3">
  {@render memberListContent()}
</div>

<!-- Mobile member list overlay -->
{#if $mobileMembersOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="md:hidden fixed inset-0 z-40 bg-black/50" transition:fade={{ duration: 150 }} onclick={() => $mobileMembersOpen = false}></div>
  <div class="md:hidden fixed inset-y-0 right-0 z-50 w-64 bg-[#0f121a] border-l border-[#1b2230] overflow-y-auto py-4 px-3 shadow-2xl" transition:fly={{ x: 264, duration: 200 }}>
    <div class="flex items-center justify-between mb-3 px-2">
      <h3 class="text-sm font-semibold text-[#e9eefc]">Members</h3>
      <button onclick={() => $mobileMembersOpen = false} class="p-1 text-[#8b95a8] hover:text-[#e9eefc]">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    {@render memberListContent()}
  </div>
{/if}

<ContextMenu
  x={ctxMenu.x}
  y={ctxMenu.y}
  items={ctxMenu.items}
  visible={ctxMenu.visible}
  onclose={closeContextMenu}
/>

<EmojiPicker
  x={emojiPicker.x}
  y={emojiPicker.y}
  visible={emojiPicker.visible}
  onselect={handleEmojiSelect}
  onclose={closeEmojiPicker}
/>
