<script lang="ts">
  import { page } from '$app/stores';
  import { tick } from 'svelte';
  import {
    currentUser,
    userAccountsStore,
    dmThreadsStore,
    dmMembersStore,
    dmMessagesStore,
    sendDmMessage,
    deleteDmMessage,
    setPublicEncryptionKey,
    getOtherDmParticipant,
    idEq
  } from '$lib/stdb';
  import { decryptDmPayload, encryptDmPayload, ensureLocalE2eeKey } from '$lib/dm-crypto';
  import {
    joinDmVoice,
    leaveDmVoice,
    setDmVideoEnabled,
    setDmScreenShareEnabled,
    dmCallState
  } from '$lib/voice';
  import { mobileNavOpen } from '$lib/mobile-nav';
  import MessageContent from '$lib/components/MessageContent.svelte';
  import UserAvatar from '$lib/components/UserAvatar.svelte';

  let messageText = $state('');
  let messagesEl: HTMLDivElement | null = $state(null);
  let decrypting = false;
  let decryptedMap = $state<Record<string, string>>({});

  let threadId = $derived($page.params.threadId);
  let threadIdBig = $derived(BigInt(threadId || '0'));

  function toBig(v: any): bigint {
    if (typeof v === 'bigint') return v;
    return BigInt(v?.toString?.() ?? '0');
  }

  function bytesFromAny(v: any): Uint8Array {
    if (v instanceof Uint8Array) return v;
    if (Array.isArray(v)) return Uint8Array.from(v);
    return new Uint8Array();
  }

  let thread = $derived(($dmThreadsStore ?? []).find((t: any) => idEq(t.id, threadIdBig)) ?? null);
  let other = $derived(
    $currentUser
      ? getOtherDmParticipant(threadIdBig, $currentUser.id, $dmMembersStore ?? [], $userAccountsStore ?? [])
      : null
  );
  let messages = $derived(
    ($dmMessagesStore ?? [])
      .filter((m: any) => idEq(m.threadId ?? m.thread_id, threadIdBig))
      .sort((a: any, b: any) => Number(toBig(a.id) - toBig(b.id)))
  );
  let inThisCall = $derived($dmCallState.joined && $dmCallState.threadId && idEq($dmCallState.threadId, threadIdBig));

  async function ensureMyKeyPublished() {
    if (!$currentUser) return;
    const myId = toBig($currentUser.id);
    const pub = await ensureLocalE2eeKey(myId);
    const remote = bytesFromAny($currentUser.publicEncryptionKey ?? $currentUser.public_encryption_key);
    if (pub.length !== remote.length || !pub.every((v, i) => v === remote[i])) {
      await setPublicEncryptionKey(pub);
    }
  }

  async function refreshDecrypted() {
    if (!$currentUser || decrypting) return;
    decrypting = true;
    try {
      const next: Record<string, string> = {};
      const myId = toBig($currentUser.id);
      for (const msg of messages) {
        const key = msg.id?.toString?.() ?? '';
        if (!key) continue;
        try {
          const plain = await decryptDmPayload(
            myId,
            bytesFromAny(msg.senderEphemeralPubkey ?? msg.sender_ephemeral_pubkey),
            bytesFromAny(msg.nonce),
            bytesFromAny(msg.ciphertext)
          );
          next[key] = plain;
        } catch {
          next[key] = '[Unable to decrypt]';
        }
      }
      decryptedMap = next;
      await tick();
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    } finally {
      decrypting = false;
    }
  }

  $effect(() => {
    if ($currentUser && threadIdBig > 0n) {
      void ensureMyKeyPublished();
      void refreshDecrypted();
    }
  });

  async function handleSend() {
    const text = messageText.trim();
    if (!text || !$currentUser || !other) return;
    const receiverKey = bytesFromAny(other.publicEncryptionKey ?? other.public_encryption_key);
    if (receiverKey.length !== 65) {
      return;
    }
    const payload = await encryptDmPayload(toBig($currentUser.id), receiverKey, text);
    await sendDmMessage({
      threadId: threadIdBig,
      receiverUserId: toBig(other.id),
      senderEphemeralPubkey: payload.senderEphemeralPubkey,
      nonce: payload.nonce,
      ciphertext: payload.ciphertext
    });
    messageText = '';
  }

  async function handleDelete(msgId: any) {
    await deleteDmMessage(toBig(msgId));
  }

  async function handleCallToggle() {
    if (inThisCall) await leaveDmVoice();
    else await joinDmVoice(threadIdBig);
  }

  function formatTime(ts: any): string {
    try {
      const n = typeof ts === 'bigint' ? Number(ts / 1000n) : Number(ts) / 1000;
      return new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
</script>

<div class="flex-1 flex flex-col min-w-0 bg-[#0f121a]">
  <!-- Header -->
  <div class="h-12 px-3 md:px-4 border-b border-[#1b2230] flex items-center justify-between flex-shrink-0">
    <div class="flex items-center gap-2 min-w-0">
      <!-- Mobile hamburger -->
      <button onclick={() => $mobileNavOpen = true} class="md:hidden p-1.5 -ml-1 text-[#8b95a8] hover:text-[#e9eefc] rounded-md hover:bg-[#1b2230]/50 transition-colors flex-shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      <!-- Mobile back button -->
      <a href="/dm" class="md:hidden p-1.5 text-[#8b95a8] hover:text-[#e9eefc] rounded-md hover:bg-[#1b2230]/50 transition-colors flex-shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M15 19l-7-7 7-7"/>
        </svg>
      </a>
      {#if other}
        <UserAvatar user={other} size="sm" />
      {/if}
      <div class="min-w-0">
        <div class="text-sm text-[#e9eefc] font-semibold truncate">{other?.displayName ?? other?.display_name ?? other?.username ?? 'Direct Message'}</div>
        <div class="text-[11px] text-[#8b95a8] truncate">@{other?.username ?? ''}</div>
      </div>
    </div>
    <div class="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
      <button
        onclick={handleCallToggle}
        class="px-2.5 md:px-3 py-1.5 text-xs md:text-sm rounded-md bg-[#1b2230] hover:bg-[#263146] text-[#e9eefc]"
      >
        {inThisCall ? 'Leave Call' : 'Call'}
      </button>
      {#if inThisCall}
        <button onclick={() => setDmVideoEnabled(!$dmCallState.videoEnabled)} class="px-2.5 md:px-3 py-1.5 text-xs md:text-sm rounded-md bg-[#1b2230] hover:bg-[#263146] text-[#e9eefc]">
          {$dmCallState.videoEnabled ? 'Stop Video' : 'Video'}
        </button>
        <button onclick={() => setDmScreenShareEnabled(!$dmCallState.screenSharing)} class="hidden sm:block px-2.5 md:px-3 py-1.5 text-xs md:text-sm rounded-md bg-[#1b2230] hover:bg-[#263146] text-[#e9eefc]">
          {$dmCallState.screenSharing ? 'Stop Share' : 'Share'}
        </button>
      {/if}
    </div>
  </div>

  <div class="px-3 md:px-4 py-1 text-[11px] text-[#8b95a8] border-b border-[#1b2230]">
    Private call media is transport-private but not end-to-end encrypted in this release.
  </div>

  <div bind:this={messagesEl} class="flex-1 overflow-y-auto px-3 md:px-4 py-4 space-y-2">
    {#if !thread}
      <div class="text-sm text-[#8b95a8]">Loading DM thread...</div>
    {:else if messages.length === 0}
      <div class="text-sm text-[#8b95a8]">This is the start of your direct message conversation.</div>
    {:else}
      {#each messages as msg (msg.id?.toString?.())}
        {@const key = msg.id?.toString?.() ?? ''}
        {@const isOwn = $currentUser && idEq(msg.senderId ?? msg.sender_id, $currentUser.id)}
        <div class="px-3 py-2 rounded-lg bg-[#111622]">
          <div class="flex items-center gap-2">
            <div class="text-xs text-[#8b95a8]">{isOwn ? 'You' : (other?.displayName ?? other?.username ?? 'User')}</div>
            <div class="text-xs text-[#5f6b82]">{formatTime(msg.sentAt ?? msg.sent_at)}</div>
            {#if isOwn}
              <button onclick={() => handleDelete(msg.id)} class="ml-auto text-xs text-red-400 hover:text-red-300">Delete</button>
            {/if}
          </div>
          {#if decryptedMap[key]}
            <MessageContent text={decryptedMap[key]} />
          {:else}
            <p class="text-sm text-[#e9eefc] break-words whitespace-pre-wrap">[Decrypting...]</p>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <div class="px-3 md:px-4 pb-3 md:pb-4">
    <div class="flex items-center bg-[#1b2230] rounded-xl px-3 md:px-4">
      <input
        type="text"
        bind:value={messageText}
        placeholder="Send an encrypted message"
        class="flex-1 bg-transparent text-[#e9eefc] py-3 outline-none placeholder-[#8b95a8] text-sm min-w-0"
      />
      <button
        onclick={handleSend}
        disabled={!messageText.trim()}
        class="ml-2 text-[#8b95a8] hover:text-[#e9eefc] disabled:opacity-30 transition-colors flex-shrink-0"
      >
        Send
      </button>
    </div>
  </div>
</div>
