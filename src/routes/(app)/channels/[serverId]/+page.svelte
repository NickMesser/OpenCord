<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    connectStdb, isConnected, isLoggedIn, isDataReady, currentUser,
    serverMembersStore, channelsStore, idEq
  } from '$lib/stdb';

  let redirecting = $state(false);

  let serverId = $derived($page.params.serverId);
  let serverIdBig = $derived(BigInt(serverId || '0'));

  let myMembership = $derived(($serverMembersStore ?? []).find(
    (m: any) => idEq(m.serverId ?? m.server_id, serverIdBig) && idEq(m.userId ?? m.user_id, $currentUser?.id)
  ));

  let serverChannels = $derived(
    ($channelsStore ?? [])
      .filter((c: any) => idEq(c.serverId ?? c.server_id, serverIdBig))
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
  );

  const lastChannelKey = (sid: string) => `last_channel:${sid}`;

  onMount(() => {
    connectStdb();
  });

  $effect(() => {
    if ($isConnected && !$isLoggedIn) {
      goto('/login');
    }
  });

  $effect(() => {
    if (!$isConnected || !$isLoggedIn || !$isDataReady) return;
    if (!myMembership || redirecting) return;

    let targetChannel = serverChannels[0] ?? null;
    if (browser && serverId && serverChannels.length > 0) {
      const savedId = localStorage.getItem(lastChannelKey(serverId));
      if (savedId) {
        const saved = serverChannels.find((c: any) => idEq(c.id, savedId));
        if (saved) targetChannel = saved;
      }
    }

    if (!targetChannel) return;

    redirecting = true;
    tick().then(() => {
      goto(`/channels/${serverId}/${targetChannel?.id}`);
    });
  });
</script>

<div class="min-h-full flex-1 flex items-center justify-center text-[#8b95a8]">
  {#if !$isConnected}
    <div>Connecting...</div>
  {:else if !$isLoggedIn}
    <div>Redirecting to login...</div>
  {:else if !$isDataReady}
    <div>Loading server...</div>
  {:else if !myMembership}
    <div>You are not a member of this server.</div>
  {:else if serverChannels.length === 0}
    <div>No channels yet. Create one to get started.</div>
  {:else}
    <div>{redirecting ? 'Opening your first channel...' : 'Select a channel'}</div>
  {/if}
</div>
