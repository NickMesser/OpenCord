<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    connectStdb, isConnected, isLoggedIn, joinServer,
    channelsStore, inviteLinksStore, idEq
  } from '$lib/stdb';

  let status = $state<'loading' | 'joining' | 'success' | 'error'>('loading');
  let errorMsg = $state('');

  let code = $derived($page.params.code);

  onMount(() => {
    connectStdb();
  });

  $effect(() => {
    if ($isConnected && !$isLoggedIn) {
      goto(`/login?redirect=/invite/${code}`);
    }
  });

  $effect(() => {
    if ($isConnected && $isLoggedIn && status === 'loading') {
      doJoin();
    }
  });

  async function doJoin() {
    status = 'joining';
    try {
      await joinServer(code);
      status = 'success';
      setTimeout(() => {
        const invite = ($inviteLinksStore ?? []).find((i: any) => i.code === code);
        if (invite) {
          const sId = invite.serverId ?? invite.server_id;
          const firstChannel = ($channelsStore ?? []).find((c: any) => idEq(c.serverId ?? c.server_id, sId));
          if (firstChannel) {
            goto(`/channels/${sId}/${firstChannel.id}`);
            return;
          }
          goto(`/channels/${sId}`);
          return;
        }
        goto('/');
      }, 1500);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('Already a member')) {
        status = 'success';
        const invite = ($inviteLinksStore ?? []).find((i: any) => i.code === code);
        if (invite) {
          const sId = invite.serverId ?? invite.server_id;
          goto(`/channels/${sId}`);
        } else {
          goto('/');
        }
      } else {
        status = 'error';
        errorMsg = msg;
      }
    }
  }
</script>

<div class="min-h-screen bg-[#0b0d12] flex items-center justify-center p-4">
  <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-8 w-full max-w-sm text-center">
    {#if status === 'loading' || status === 'joining'}
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1b2230] flex items-center justify-center animate-pulse">
        <svg class="w-8 h-8 text-[#5865f2]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
        </svg>
      </div>
      <h2 class="text-xl font-bold text-[#e9eefc] mb-2">Joining server...</h2>
      <p class="text-[#8b95a8] text-sm">Invite code: {code}</p>
    {:else if status === 'success'}
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1b4332] flex items-center justify-center">
        <svg class="w-8 h-8 text-[#23a559]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <h2 class="text-xl font-bold text-[#e9eefc] mb-2">Joined successfully!</h2>
      <p class="text-[#8b95a8] text-sm">Redirecting you to the server...</p>
    {:else}
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#3b1219] flex items-center justify-center">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </div>
      <h2 class="text-xl font-bold text-[#e9eefc] mb-2">Unable to join</h2>
      <p class="text-red-400 text-sm mb-4">{errorMsg}</p>
      <a href="/" class="text-[#5865f2] hover:underline text-sm">Go home</a>
    {/if}
  </div>
</div>
