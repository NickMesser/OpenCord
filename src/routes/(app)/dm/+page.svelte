<script lang="ts">
  import { goto } from '$app/navigation';
  import { tick } from 'svelte';
  import {
    currentUser,
    userAccountsStore,
    dmThreadsStore,
    dmMembersStore,
    getMyDmThreads,
    getOtherDmParticipant,
    openDmThread,
    setPublicEncryptionKey
  } from '$lib/stdb';
  import { ensureLocalE2eeKey, getLocalPublicE2eeKey } from '$lib/dm-crypto';
  import { mobileNavOpen } from '$lib/mobile-nav';

  let search = $state('');
  let syncingKey = false;

  function toBig(v: any): bigint {
    if (typeof v === 'bigint') return v;
    return BigInt(v?.toString?.() ?? '0');
  }

  function bytesFromAny(v: any): Uint8Array {
    if (v instanceof Uint8Array) return v;
    if (Array.isArray(v)) return Uint8Array.from(v);
    return new Uint8Array();
  }

  function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  async function ensureKeyPublished() {
    if (!$currentUser || syncingKey) return;
    syncingKey = true;
    try {
      const myId = toBig($currentUser.id);
      const localPub = await ensureLocalE2eeKey(myId);
      const remotePub = bytesFromAny($currentUser.publicEncryptionKey ?? $currentUser.public_encryption_key);
      if (!bytesEqual(localPub, remotePub)) {
        await setPublicEncryptionKey(localPub);
      }
      await getLocalPublicE2eeKey(myId);
    } finally {
      syncingKey = false;
    }
  }

  $effect(() => {
    void ensureKeyPublished();
  });

  let myThreads = $derived(
    $currentUser
      ? getMyDmThreads($currentUser.id, $dmThreadsStore ?? [], $dmMembersStore ?? [])
      : []
  );

  let users = $derived(
    ($userAccountsStore ?? [])
      .filter((u: any) => !$currentUser || toBig(u.id) !== toBig($currentUser.id))
      .filter((u: any) => {
        const s = search.trim().toLowerCase();
        if (!s) return true;
        const display = (u.displayName ?? u.display_name ?? '').toLowerCase();
        const user = (u.username ?? '').toLowerCase();
        return display.includes(s) || user.includes(s);
      })
      .slice(0, 30)
  );

  async function startDm(userId: any) {
    if (!$currentUser) return;
    const targetId = toBig(userId);
    await openDmThread(targetId);
    await tick();
    const me = toBig($currentUser.id);
    const low = me < targetId ? me : targetId;
    const high = me < targetId ? targetId : me;
    const pairKey = `${low.toString()}:${high.toString()}`;
    const thread = ($dmThreadsStore ?? []).find((t: any) => (t.pairKey ?? t.pair_key) === pairKey);
    if (thread?.id) goto(`/dm/${thread.id}`);
  }
</script>

<div class="flex-1 min-w-0 flex flex-col md:flex-row bg-[#0f121a]">
  <!-- Mobile header -->
  <div class="md:hidden flex items-center h-12 px-3 border-b border-[#1b2230] flex-shrink-0">
    <button onclick={() => $mobileNavOpen = true} class="p-1.5 -ml-1 text-[#8b95a8] hover:text-[#e9eefc] rounded-md hover:bg-[#1b2230]/50 transition-colors">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>
    <h2 class="text-[#e9eefc] font-semibold ml-2">Direct Messages</h2>
  </div>

  <!-- User search panel -->
  <div class="w-full md:w-80 md:border-r border-[#1b2230] p-4 flex-shrink-0">
    <h2 class="hidden md:block text-[#e9eefc] font-semibold text-lg mb-3">Direct Messages</h2>
    <input
      type="text"
      bind:value={search}
      placeholder="Search users"
      class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-3 py-2 outline-none focus:border-[#5865f2]"
    />
    <div class="mt-3 space-y-1 max-h-60 md:max-h-[calc(100vh-150px)] overflow-y-auto">
      {#each users as u (u.id?.toString?.())}
        <button
          onclick={() => startDm(u.id)}
          class="w-full text-left px-3 py-2 rounded-lg hover:bg-[#1b2230]/60 transition-colors"
        >
          <div class="text-sm text-[#e9eefc] truncate">{u.displayName ?? u.display_name ?? u.username}</div>
          <div class="text-xs text-[#8b95a8] truncate">@{u.username}</div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Recent chats -->
  <div class="flex-1 min-w-0 p-4 border-t md:border-t-0 border-[#1b2230]">
    <h3 class="text-[#e9eefc] font-semibold mb-3">Recent Chats</h3>
    {#if !$currentUser || myThreads.length === 0}
      <div class="text-[#8b95a8] text-sm">No direct messages yet. Search for someone to start chatting.</div>
    {:else}
      <div class="space-y-1">
        {#each myThreads as t (t.id?.toString?.())}
          {@const other = getOtherDmParticipant(t.id, $currentUser.id, $dmMembersStore ?? [], $userAccountsStore ?? [])}
          <a
            href="/dm/{t.id}"
            class="block px-3 py-2 rounded-lg hover:bg-[#1b2230]/60 transition-colors"
          >
            <div class="text-sm text-[#e9eefc]">{other?.displayName ?? other?.display_name ?? other?.username ?? 'Unknown'}</div>
            <div class="text-xs text-[#8b95a8]">@{other?.username ?? 'user'}</div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
