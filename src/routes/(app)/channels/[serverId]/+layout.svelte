<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import {
    currentUser, serversStore, serverMembersStore, categoriesStore,
    channelsStore, inviteLinksStore, voiceMembersStore, userAccountsStore,
    fileUploadsStore, getFileDataUrl, idEq
  } from '$lib/stdb';
  import { createCategory, createChannel, createInvite, deleteServer, leaveServer } from '$lib/stdb';
  import { voiceState, audioControlStore, audioLevelsStore, toggleMute, toggleDeafen, leaveVoice } from '$lib/voice';
  import { mobileNavOpen } from '$lib/mobile-nav';

  let { children } = $props();

  let showCreateChannel = $state(false);
  let showCreateCategory = $state(false);
  let showInvite = $state(false);
  let newChannelName = $state('');
  let newChannelType = $state<'Text' | 'Voice'>('Text');
  let newChannelCategoryId = $state(0n);
  let newCategoryName = $state('');
  let inviteCopied = $state(false);
  let collapsedCategories = $state<Set<string>>(new Set());

  let serverId = $derived($page.params.serverId);
  let serverIdBig = $derived(BigInt(serverId || '0'));

  let server = $derived(($serversStore ?? []).find((s: any) => idEq(s.id, serverIdBig)) ?? null);

  let isOwner = $derived(server && $currentUser && idEq(server.ownerId ?? server.owner_id, $currentUser.id));
  let myMembership = $derived(($serverMembersStore ?? []).find(
    (m: any) => idEq(m.serverId ?? m.server_id, serverIdBig) && idEq(m.userId ?? m.user_id, $currentUser?.id)
  ));
  let myRole = $derived(myMembership ? (myMembership.role?.tag ?? myMembership.role) : null);
  let isAdmin = $derived(myRole === 'Owner' || myRole === 'Admin');

  let serverCategories = $derived(($categoriesStore ?? [])
    .filter((c: any) => idEq(c.serverId ?? c.server_id, serverIdBig))
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));

  let serverChannels = $derived(($channelsStore ?? [])
    .filter((c: any) => idEq(c.serverId ?? c.server_id, serverIdBig))
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)));

  let serverInvites = $derived(($inviteLinksStore ?? [])
    .filter((i: any) => idEq(i.serverId ?? i.server_id, serverIdBig)));

  function channelsForCategory(categoryId: any) {
    return serverChannels.filter((c: any) => idEq(c.categoryId ?? c.category_id, categoryId));
  }

  function channelTypeTag(ch: any): string {
    const ct = ch.channelType ?? ch.channel_type;
    if (!ct) return 'text';
    if (typeof ct === 'string') return ct.toLowerCase();
    if (ct.tag) return ct.tag.toLowerCase();
    const keys = Object.keys(ct);
    return keys.length ? keys[0].toLowerCase() : 'text';
  }

  let activeChannelId = $derived($page.params.channelId);

  let voiceChannel = $derived(($channelsStore ?? []).find((c: any) => idEq(c.id, $voiceState.channelId)) ?? null);
  let voiceServer = $derived(voiceChannel
    ? ($serversStore ?? []).find((s: any) => idEq(s.id, voiceChannel.serverId ?? voiceChannel.server_id))
    : null);
  let voiceServerId = $derived(voiceServer?.id?.toString?.() ?? '');
  let voiceChannelId = $derived(voiceChannel?.id?.toString?.() ?? '');
  let showVoiceControls = $derived($voiceState.joined || $voiceState.connecting);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      await createCategory(serverIdBig, newCategoryName.trim());
      newCategoryName = '';
      showCreateCategory = false;
    } catch (e) { console.error(e); }
  }

  async function handleCreateChannel() {
    if (!newChannelName.trim()) return;
    try {
      await createChannel(serverIdBig, newChannelCategoryId, newChannelName.trim(), { tag: newChannelType });
      newChannelName = '';
      showCreateChannel = false;
    } catch (e) { console.error(e); }
  }

  async function handleCreateInvite() {
    try {
      await createInvite(serverIdBig, 0);
    } catch (e) { console.error(e); }
  }

  async function copyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${code}`);
      inviteCopied = true;
      setTimeout(() => inviteCopied = false, 2000);
    } catch { /* clipboard may fail */ }
  }

  async function handleDeleteServer() {
    if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) return;
    try {
      await deleteServer(serverIdBig);
      goto('/');
    } catch (e) { console.error(e); }
  }

  async function handleLeaveServer() {
    if (!confirm('Are you sure you want to leave this server?')) return;
    try {
      await leaveServer(serverIdBig);
      goto('/');
    } catch (e) { console.error(e); }
  }

  function toggleCategory(catId: string) {
    const next = new Set(collapsedCategories);
    if (next.has(catId)) next.delete(catId);
    else next.add(catId);
    collapsedCategories = next;
  }

  let audioTalkingRmsThreshold = 0.02;

  function voiceMembersForChannel(channelId: any) {
    return ($voiceMembersStore ?? []).filter(
      (m: any) => idEq(m.channelId ?? m.channel_id, channelId)
    );
  }

  function getUser(userId: any) {
    return ($userAccountsStore ?? []).find((u: any) => idEq(u.id, userId)) ?? null;
  }

  function getUserAvatarUrl(user: any): string | null {
    if (!user) return null;
    return getFileDataUrl(user.avatarFileId ?? user.avatar_file_id, $fileUploadsStore ?? []);
  }

  function isSpeaking(member: any): boolean {
    const hex = member.identity?.toHexString?.() ?? '';
    if (!hex) return false;
    const level = $audioLevelsStore?.[hex];
    return !!level && level.rms >= audioTalkingRmsThreshold && (Date.now() - level.at) < 1500;
  }
</script>

{#snippet channelSidebarContent()}
  <!-- Server header -->
  <div class="h-12 px-4 flex items-center justify-between border-b border-[#1b2230] flex-shrink-0">
    <h2 class="font-semibold text-[#e9eefc] truncate">{server?.name ?? 'Unknown Server'}</h2>
  </div>

  <!-- Channel list -->
  <div class="flex-1 overflow-y-auto py-2 space-y-0.5">
    {#each serverCategories as cat (cat.id?.toString?.())}
      {@const catIdStr = cat.id?.toString?.() ?? ''}
      {@const collapsed = collapsedCategories.has(catIdStr)}

      <div class="px-1 pt-4 first:pt-2">
        <div class="flex items-center gap-1 w-full px-2">
          <button
            class="flex items-center gap-1 flex-1 text-xs font-semibold text-[#8b95a8] hover:text-[#e9eefc] uppercase tracking-wide"
            onclick={() => toggleCategory(catIdStr)}
          >
            <svg class="w-3 h-3 transition-transform {collapsed ? '-rotate-90' : ''}" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
            </svg>
            <span class="truncate">{cat.name}</span>
          </button>
          {#if isAdmin}
            <button
              class="ml-auto text-[#8b95a8] hover:text-[#e9eefc]"
              title="Create Channel"
              onclick={() => { newChannelCategoryId = BigInt(cat.id?.toString?.() ?? '0'); showCreateChannel = true; }}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if !collapsed}
          {#each channelsForCategory(cat.id) as ch (ch.id?.toString?.())}
            {@const isActive = activeChannelId === ch.id?.toString?.()}
            {@const isVoice = channelTypeTag(ch) === 'voice'}
            {@const vcMembers = isVoice ? voiceMembersForChannel(ch.id) : []}
            <a
              href="/channels/{serverId}/{ch.id}"
              class="flex items-center gap-2 px-2 py-1.5 mx-1 mt-0.5 rounded-md text-sm transition-colors
                {isActive ? 'bg-[#1b2230] text-[#e9eefc]' : 'text-[#8b95a8] hover:bg-[#1b2230]/50 hover:text-[#e9eefc]'}"
            >
              {#if isVoice}
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z"/>
                </svg>
              {:else}
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                </svg>
              {/if}
              <span class="truncate">{ch.name}</span>
            </a>

            {#if isVoice && vcMembers.length > 0}
              <div class="ml-7 mr-1 space-y-0.5">
                {#each vcMembers as vm (vm.id?.toString?.())}
                  {@const vmUser = getUser(vm.userId ?? vm.user_id)}
                  {@const speaking = isSpeaking(vm)}
                  {@const avatarUrl = getUserAvatarUrl(vmUser)}
                  {@const vmMuted = vm.muted ?? false}
                  {@const vmDeafened = vm.deafened ?? false}
                  {@const vmVideo = vm.videoOn ?? vm.video_on ?? false}
                  {@const vmScreen = vm.screenSharing ?? vm.screen_sharing ?? false}
                  <div class="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-[#1b2230]/30 group/vm">
                    <!-- Avatar with speaking ring -->
                    <div class="relative flex-shrink-0">
                      <div
                        class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden transition-shadow
                          {speaking ? 'ring-2 ring-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : ''}"
                        style="background: #5865f2;"
                      >
                        {#if avatarUrl}
                          <img src={avatarUrl} alt="" class="w-full h-full object-cover" />
                        {:else}
                          {(vmUser?.username ?? '?')[0]?.toUpperCase() ?? '?'}
                        {/if}
                      </div>
                    </div>
                    <!-- Username -->
                    <span class="text-xs text-[#8b95a8] truncate flex-1 {speaking ? 'text-[#e9eefc]' : ''}">
                      {vmUser?.displayName ?? vmUser?.display_name ?? vmUser?.username ?? 'Unknown'}
                    </span>
                    <!-- Status icons -->
                    <div class="flex items-center gap-0.5 flex-shrink-0">
                      {#if vmScreen}
                        <!-- Screen share icon -->
                        <svg class="w-3.5 h-3.5 text-[#8b95a8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" title="Sharing Screen">
                          <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                      {/if}
                      {#if vmVideo}
                        <!-- Video icon -->
                        <svg class="w-3.5 h-3.5 text-[#8b95a8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" title="Video On">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                      {/if}
                      {#if vmDeafened}
                        <!-- Deafened icon -->
                        <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" title="Deafened">
                          <path d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 14.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656"/>
                          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                        </svg>
                      {:else if vmMuted}
                        <!-- Muted icon -->
                        <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" title="Muted">
                          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z"/>
                          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
                        </svg>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    {/each}
  </div>

  <!-- Bottom actions -->
  <div class="border-t border-[#1b2230] p-2 space-y-1 flex-shrink-0">
    {#if isAdmin}
      <button
        onclick={() => showCreateCategory = true}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#8b95a8] hover:text-[#e9eefc] hover:bg-[#1b2230]/50 rounded-md transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New Category
      </button>
    {/if}

    <button
      onclick={() => { showInvite = true; if (serverInvites.length === 0 && isAdmin) handleCreateInvite(); }}
      class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#8b95a8] hover:text-[#e9eefc] hover:bg-[#1b2230]/50 rounded-md transition-colors"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
      </svg>
      Invite People
    </button>

    {#if isOwner}
      <button
        onclick={handleDeleteServer}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Delete Server
      </button>
    {:else}
      <button
        onclick={handleLeaveServer}
        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-md transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        Leave Server
      </button>
    {/if}

    <!-- User info bar -->
    <div class="flex items-start gap-2 px-3 py-2 mt-1 bg-[#080a0f] rounded-lg">
      <div class="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
        {($currentUser?.username ?? '?')[0]?.toUpperCase()}
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-[#e9eefc] truncate">{$currentUser?.displayName ?? $currentUser?.display_name ?? $currentUser?.username ?? 'User'}</div>
        <div class="text-xs text-[#8b95a8] truncate">{$currentUser?.username ?? ''}</div>
        {#if showVoiceControls}
          <div class="mt-2 p-2 rounded-md bg-[#0b0d12] border border-[#1b2230]">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[10px] text-[#8b95a8] uppercase tracking-wide">Voice</div>
                <div class="text-xs text-[#e9eefc] truncate">
                  {#if voiceChannel}
                    <a
                      class="hover:underline"
                      href="/channels/{voiceServerId}/{voiceChannelId}"
                      title="Go to voice channel"
                    >
                      #{voiceChannel.name ?? 'Voice Channel'}
                      {#if voiceServer && !idEq(voiceServer.id, serverIdBig)}
                        <span class="text-[#8b95a8]"> • {voiceServer.name ?? 'Server'}</span>
                      {/if}
                    </a>
                  {:else}
                    {$voiceState.connecting ? 'Connecting...' : 'Voice Channel'}
                  {/if}
                </div>
              </div>
              <button
                onclick={leaveVoice}
                class="p-1.5 rounded-md bg-red-900/30 text-red-300 hover:bg-red-900/50"
                title="Disconnect"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M18 8a4 4 0 01-8 0m8 0a4 4 0 10-8 0m8 0v4a4 4 0 01-8 0V8m12 6l4 4m0-4l-4 4"/>
                </svg>
              </button>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              <button
                onclick={toggleMute}
                class="px-2 py-1 text-[11px] rounded-md {($audioControlStore.muted ? 'bg-red-900/30 text-red-300' : 'bg-[#1b2230] text-[#e9eefc]')}"
                title={$audioControlStore.muted ? 'Unmute' : 'Mute'}
              >
                {$audioControlStore.muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onclick={toggleDeafen}
                class="px-2 py-1 text-[11px] rounded-md {($audioControlStore.deafened ? 'bg-red-900/30 text-red-300' : 'bg-[#1b2230] text-[#e9eefc]')}"
                title={$audioControlStore.deafened ? 'Undeafen' : 'Deafen'}
              >
                {$audioControlStore.deafened ? 'Undeafen' : 'Deafen'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/snippet}

<!-- Desktop channel sidebar -->
<div class="hidden md:flex w-60 flex-shrink-0 bg-[#0f121a] border-r border-[#1b2230] flex-col">
  {@render channelSidebarContent()}
</div>

<!-- Main content -->
<div class="flex-1 flex min-w-0">
  {@render children()}
</div>

<!-- Mobile channel sidebar overlay -->
{#if $mobileNavOpen}
  <div class="md:hidden fixed inset-y-0 left-[72px] z-50 w-60 bg-[#0f121a] border-r border-[#1b2230] flex flex-col shadow-2xl" transition:fly={{ x: -312, duration: 200 }}>
    {@render channelSidebarContent()}
  </div>
{/if}

<!-- Create Category modal -->
{#if showCreateCategory}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onclick={() => showCreateCategory = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-6 w-full max-w-sm" role="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold text-[#e9eefc] mb-4">Create Category</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleCreateCategory(); }}>
        <input
          type="text"
          bind:value={newCategoryName}
          placeholder="Category name"
          class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors mb-4"
        />
        <div class="flex justify-end gap-3">
          <button type="button" onclick={() => showCreateCategory = false} class="px-4 py-2 text-sm text-[#8b95a8] hover:text-[#e9eefc]">Cancel</button>
          <button type="submit" class="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-lg">Create</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Create Channel modal -->
{#if showCreateChannel}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onclick={() => showCreateChannel = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-6 w-full max-w-sm" role="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold text-[#e9eefc] mb-4">Create Channel</h2>
      <form onsubmit={(e) => { e.preventDefault(); handleCreateChannel(); }}>
        <input
          type="text"
          bind:value={newChannelName}
          placeholder="channel-name"
          class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors mb-4"
        />
        <div class="mb-4">
          <label for="channelType" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">Channel Type</label>
          <select
            id="channelType"
            bind:value={newChannelType}
            class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-2 outline-none focus:border-[#5865f2] transition-colors"
          >
            <option value="Text">Text</option>
            <option value="Voice">Voice</option>
          </select>
        </div>
        <div class="flex justify-end gap-3">
          <button type="button" onclick={() => showCreateChannel = false} class="px-4 py-2 text-sm text-[#8b95a8] hover:text-[#e9eefc]">Cancel</button>
          <button type="submit" class="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-lg">Create</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Invite modal -->
{#if showInvite}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onclick={() => showInvite = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-6 w-full max-w-md" role="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-lg font-bold text-[#e9eefc] mb-2">Invite friends to {server?.name}</h2>
      <p class="text-sm text-[#8b95a8] mb-4">Share the invite link below with your friends.</p>

      {#if serverInvites.length > 0}
        {#each serverInvites as inv (inv.id?.toString?.())}
          <div class="flex items-center gap-2 mb-2">
            <input
              type="text"
              readonly
              value="{typeof window !== 'undefined' ? window.location.origin : ''}/invite/{inv.code}"
              class="flex-1 bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-2 text-sm outline-none min-w-0"
            />
            <button
              onclick={() => copyInviteCode(inv.code)}
              class="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
            >
              {inviteCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        {/each}
      {:else}
        <p class="text-sm text-[#8b95a8]">Generating invite link...</p>
      {/if}

      {#if isAdmin}
        <button
          onclick={handleCreateInvite}
          class="mt-3 text-sm text-[#5865f2] hover:underline"
        >
          Generate new link
        </button>
      {/if}

      <div class="flex justify-end mt-4">
        <button onclick={() => showInvite = false} class="px-4 py-2 text-sm text-[#8b95a8] hover:text-[#e9eefc]">Done</button>
      </div>
    </div>
  </div>
{/if}
