<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    connectStdb, isConnected, isLoggedIn, currentUser,
    serversStore, serverMembersStore, idEq,
    createServer, logout
  } from '$lib/stdb';

  let { children } = $props();

  let showCreateServer = $state(false);
  let newServerName = $state('');
  let createLoading = $state(false);

  onMount(() => {
    connectStdb();
  });

  $effect(() => {
    if ($isConnected && !$isLoggedIn) {
      goto('/login');
    }
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

  async function handleLogout() {
    await logout();
    goto('/login');
  }
</script>

<div class="h-screen flex bg-[#0b0d12] text-[#e9eefc] overflow-hidden">
  <!-- Server sidebar (72px) -->
  <nav class="w-[72px] flex-shrink-0 bg-[#080a0f] flex flex-col items-center py-3 gap-2 overflow-y-auto">
    <!-- Home button -->
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

    <!-- Server icons -->
    {#each myServers as server (server.id?.toString?.())}
      <a
        href="/channels/{server.id}"
        class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#5865f2] hover:rounded-xl flex items-center justify-center transition-all duration-200 text-sm font-semibold"
        title={server.name}
      >
        {getInitials(server.name)}
      </a>
    {/each}

    <!-- Add server button -->
    <button
      onclick={() => showCreateServer = true}
      class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-[#23a559] hover:rounded-xl flex items-center justify-center transition-all duration-200 text-[#23a559] hover:text-white"
      title="Add a Server"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    </button>

    <div class="flex-1"></div>

    <!-- Logout button -->
    <button
      onclick={handleLogout}
      class="w-12 h-12 rounded-2xl bg-[#0f121a] hover:bg-red-900/50 flex items-center justify-center transition-all duration-200 text-[#8b95a8] hover:text-red-400"
      title="Log out"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
      </svg>
    </button>
  </nav>

  <!-- Main content area -->
  <div class="flex-1 flex min-w-0">
    {@render children()}
  </div>
</div>

<!-- Create server modal -->
{#if showCreateServer}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onclick={() => showCreateServer = false}>
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
