<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { connectStdb, login, isConnected, isLoggedIn, actionError } from '$lib/stdb';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  onMount(() => {
    connectStdb();
  });

  $effect(() => {
    if ($isLoggedIn) {
      goto('/');
    }
  });

  async function handleSubmit() {
    error = '';
    if (!email.trim() || !password) {
      error = 'Please fill in all fields';
      return;
    }
    if (!$isConnected) {
      error = 'Not connected to server yet. Please wait...';
      return;
    }
    loading = true;
    try {
      await login(email, password);
    } catch (e: any) {
      error = e?.message ?? String(e);
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-[#0b0d12] flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl p-8">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-[#e9eefc]">Welcome back!</h1>
        <p class="text-[#8b95a8] mt-2">We're so excited to see you again!</p>
      </div>

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-5">
        <div>
          <label for="email" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            bind:value={email}
            class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors"
            required
          />
        </div>

        <div>
          <label for="password" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-3 outline-none focus:border-[#5865f2] transition-colors"
            required
          />
        </div>

        {#if error}
          <p class="text-sm text-red-400">{error}</p>
        {/if}

        <button
          type="submit"
          disabled={loading || !$isConnected}
          class="w-full bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-3 transition-colors"
        >
          {#if loading}
            Logging in...
          {:else if !$isConnected}
            Connecting...
          {:else}
            Log In
          {/if}
        </button>
      </form>

      <p class="mt-4 text-sm text-[#8b95a8]">
        Need an account?
        <a href="/register" class="text-[#5865f2] hover:underline">Register</a>
      </p>
    </div>
  </div>
</div>
