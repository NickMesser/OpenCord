<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    connectStdb, isConnected, isLoggedIn, isDataReady, currentUser,
    serversStore, serverMembersStore, channelsStore, idEq,
    createServer
  } from '$lib/stdb';

  let redirecting = $state(false);
  let serverName = $state('');
  let createLoading = $state(false);
  let createError = $state('');

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
      ? $serversStore.filter((s: any) =>
          $serverMembersStore.some((m: any) => idEq(m.serverId ?? m.server_id, s.id) && idEq(m.userId ?? m.user_id, $currentUser?.id))
        )
      : []
  );

  $effect(() => {
    if (!$isConnected || !$isLoggedIn || !$isDataReady) return;
    if (redirecting || !$currentUser) return;
    if (myServers.length === 0) return;
    tick().then(tryRedirect);
  });

  function tryRedirect() {
    const user = $currentUser;
    if (!user) return;
    if (myServers.length === 0) return;
    if (myServers.length > 0) {
      const firstServer = myServers[0];
      const firstChannel = ($channelsStore ?? []).find((c: any) => idEq(c.serverId ?? c.server_id, firstServer.id));
      if (firstChannel) {
        redirecting = true;
        goto(`/channels/${firstServer.id}`);
        return;
      }
    }
  }

  async function handleCreateServer() {
    createError = '';
    const name = serverName.trim();
    if (!name) {
      createError = 'Please enter a server name';
      return;
    }
    createLoading = true;
    try {
      await createServer(name);
      serverName = '';
    } catch (e: any) {
      createError = e?.message ?? String(e);
    } finally {
      createLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#0b0d12] flex items-center justify-center">
  {#if !$isConnected}
    <div class="text-[#8b95a8] text-lg">Connecting...</div>
  {:else if !$isLoggedIn}
    <div class="text-[#8b95a8] text-lg">Redirecting to login...</div>
  {:else if !$isDataReady}
    <div class="text-[#8b95a8] text-lg">Loading...</div>
  {:else if myServers.length === 0}
    <div class="w-full max-w-md bg-[#0f121a] border border-[#1b2230] rounded-2xl p-8">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-[#e9eefc]">Create your first server</h1>
        <p class="text-[#8b95a8] mt-2">Start a space for your community.</p>
      </div>

      <form onsubmit={(e) => { e.preventDefault(); handleCreateServer(); }} class="space-y-4">
        <div>
          <label for="serverName" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
            Server Name
          </label>
          <input
            id="serverName"
            type="text"
            bind:value={serverName}
            placeholder="My Awesome Server"
            class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors"
          />
        </div>

        {#if createError}
          <p class="text-sm text-red-400">{createError}</p>
        {/if}

        <button
          type="submit"
          disabled={createLoading || !serverName.trim()}
          class="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-3 transition-colors"
        >
          {createLoading ? 'Creating...' : 'Create Server'}
        </button>
      </form>
    </div>
  {:else}
    <div class="text-[#8b95a8] text-lg">{redirecting ? 'Opening your server...' : 'Loading...'}</div>
  {/if}
</div>
