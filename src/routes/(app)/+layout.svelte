<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { fly, fade } from 'svelte/transition';
  import {
    connectStdb, isConnected, isLoggedIn, currentUser,
    serversStore, serverMembersStore, fileUploadsStore, idEq,
    createServer, getFileDataUrl
  } from '$lib/stdb';
  import { mobileNavOpen, mobileMembersOpen } from '$lib/mobile-nav';
  import ProfileModal from '$lib/components/ProfileModal.svelte';

  let { children } = $props();

  let showCreateServer = $state(false);
  let newServerName = $state('');
  let createLoading = $state(false);
  let showJoinServer = $state(false);
  let joinLink = $state('');
  let joinError = $state('');
  let showProfile = $state(false);

  let myAvatarUrl = $derived(
    $currentUser
      ? getFileDataUrl($currentUser.avatarFileId ?? $currentUser.avatar_file_id, $fileUploadsStore ?? [])
      : null
  );

  onMount(() => {
    connectStdb();
  });

  $effect(() => {
    if ($isConnected && !$isLoggedIn) {
      goto('/login');
    }
  });

  $effect(() => {
    $page.url.pathname;
    $mobileNavOpen = false;
    $mobileMembersOpen = false;
  });

  let myServers = $derived(
    ($currentUser && $serversStore && $serverMembersStore)
      ? $serversStore.filter((s: any) => {
          const userId = $currentUser?.id;
          return $serverMembersStore.some((m: any) => idEq(m.serverId ?? m.server_id, s.id) && idEq(m.userId ?? m.user_id, userId));
        })
      : []
  );

  function getInitials(name: string): string {
    return name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  }

  async function handleCreateServer() {
    if (!newServerName.trim()) return;
    createLoading = true;
    try {
      await createServer(newServerName.trim());
      newServerName = '';
      showCreateServer = false;
    } catch (e: any) {
      console.error(e);
    } finally {
      createLoading = false;
    }
  }

  function extractInviteCode(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      const inviteIndex = parts.findIndex((p) => p === 'invite');
      if (inviteIndex >= 0 && parts[inviteIndex + 1]) return parts[inviteIndex + 1];
    } catch {
      // Not a full URL, handle below.
    }

    const raw = trimmed.split(/[?#]/)[0];
    const match = raw.match(/(?:^|\/)invite\/([A-Za-z0-9_-]+)/);
    if (match?.[1]) return match[1];
    return raw;
  }

  function handleJoinServer() {
    joinError = '';
    const code = extractInviteCode(joinLink);
    if (!code) {
      joinError = 'Please enter a valid invite link or code';
      return;
    }
    showJoinServer = false;
    joinLink = '';
    goto(`/invite/${code}`);
  }
</script>

{#snippet serverNavContent()}
  <a
    href="/"
    class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#5865f2] hover:rounded-xl flex items-center justify-center transition-all duration-200 mb-1"
    title="Home"
  >
    <svg class="w-6 h-6 text-[#e9eefc]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  </a>

  <div class="w-8 h-[2px] bg-[#1b2230] rounded-full"></div>

  <a
    href="/dm"
    class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#5865f2] hover:rounded-xl flex items-center justify-center transition-all duration-200"
    title="Direct Messages"
  >
    <svg class="w-6 h-6 text-[#e9eefc]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M7 8h10M7 12h6m-9 8l3-3h12a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
    </svg>
  </a>

  {#each myServers as server (server.id?.toString?.())}
    <a
      href="/channels/{server.id}"
      class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#5865f2] hover:rounded-xl flex items-center justify-center transition-all duration-200 text-sm font-semibold"
      title={server.name}
    >
      {getInitials(server.name)}
    </a>
  {/each}

  <button
    onclick={() => showCreateServer = true}
    class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#23a559] hover:rounded-xl flex items-center justify-center transition-all duration-200 text-[#23a559] hover:text-white"
    title="Add a Server"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  </button>

  <button
    onclick={() => { showJoinServer = true; joinError = ''; }}
    class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#5865f2] hover:rounded-xl flex items-center justify-center transition-all duration-200 text-[#5865f2] hover:text-white"
    title="Join a Server"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M10.5 13.5L13.5 10.5M8 16a4 4 0 010-5.657l2.343-2.343a4 4 0 015.657 0m0 0a4 4 0 010 5.657l-2.343 2.343a4 4 0 01-5.657 0"/>
    </svg>
  </button>

  <div class="flex-1"></div>

  <button
    onclick={() => showProfile = true}
    class="w-12 h-12 rounded-full bg-[#5865f2] hover:ring-2 hover:ring-[#5865f2] flex items-center justify-center transition-all duration-200 overflow-hidden flex-shrink-0"
    title="Profile"
  >
    {#if myAvatarUrl}
      <img src={myAvatarUrl} alt="My avatar" class="w-full h-full object-cover" />
    {:else}
      <span class="text-sm font-semibold text-white">
        {($currentUser?.username ?? '?')[0]?.toUpperCase()}
      </span>
    {/if}
  </button>
{/snippet}

<div class="h-screen flex bg-[#0b0d12] text-[#e9eefc] overflow-hidden">
  <!-- Desktop server sidebar -->
  <nav class="hidden md:flex w-[72px] flex-shrink-0 bg-[#080a0f] flex-col items-center py-3 gap-2 overflow-y-auto">
    {@render serverNavContent()}
  </nav>

  <!-- Main content area -->
  <div class="flex-1 flex min-w-0">
    {@render children()}
  </div>
</div>

<!-- Mobile server sidebar overlay -->
{#if $mobileNavOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="md:hidden fixed inset-0 z-40 bg-black/50" transition:fade={{ duration: 150 }} onclick={() => $mobileNavOpen = false}></div>
  <nav class="md:hidden fixed inset-y-0 left-0 z-50 w-[72px] bg-[#080a0f] flex flex-col items-center py-3 gap-2 overflow-y-auto shadow-2xl" transition:fly={{ x: -72, duration: 200 }}>
    {@render serverNavContent()}
  </nav>
{/if}

<!-- Create server modal -->
{#if showCreateServer}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onclick={() => showCreateServer = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-6 w-full max-w-md" role="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-xl font-bold text-[#e9eefc] mb-1">Create a server</h2>
      <p class="text-sm text-[#8b95a8] mb-6">Your server is where you and your friends hang out.</p>

      <form onsubmit={(e) => { e.preventDefault(); handleCreateServer(); }}>
        <label for="serverName" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
          Server Name
        </label>
        <input
          id="serverName"
          type="text"
          bind:value={newServerName}
          placeholder="My Awesome Server"
          class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors mb-6"
        />

        <div class="flex justify-end gap-3">
          <button
            type="button"
            onclick={() => showCreateServer = false}
            class="px-4 py-2 text-sm text-[#8b95a8] hover:text-[#e9eefc] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createLoading || !newServerName.trim()}
            class="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {createLoading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Profile modal -->
<ProfileModal bind:open={showProfile} />

<!-- Join server modal -->
{#if showJoinServer}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onclick={() => showJoinServer = false}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-6 w-full max-w-md" role="dialog" onclick={(e) => e.stopPropagation()}>
      <h2 class="text-xl font-bold text-[#e9eefc] mb-1">Join a server</h2>
      <p class="text-sm text-[#8b95a8] mb-6">Paste an invite link or code to join.</p>

      <form onsubmit={(e) => { e.preventDefault(); handleJoinServer(); }}>
        <label for="inviteLink" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
          Invite Link
        </label>
        <input
          id="inviteLink"
          type="text"
          bind:value={joinLink}
          placeholder="https://your-domain/invite/abc123"
          class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors mb-3"
        />

        {#if joinError}
          <p class="text-sm text-red-400 mb-3">{joinError}</p>
        {/if}

        <div class="flex justify-end gap-3">
          <button
            type="button"
            onclick={() => showJoinServer = false}
            class="px-4 py-2 text-sm text-[#8b95a8] hover:text-[#e9eefc] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!joinLink.trim()}
            class="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Join
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
