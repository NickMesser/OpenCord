<script lang="ts">
  import { currentUser, fileUploadsStore, updateProfile, updateAvatar, removeAvatar, updateBanner, removeBanner, getFileDataUrl, logout } from '$lib/stdb';
  import { goto } from '$app/navigation';

  let { open = $bindable(false) }: { open: boolean } = $props();

  let displayName = $state('');
  let status = $state('');
  let saving = $state(false);
  let error = $state('');
  let avatarPreview = $state<string | null>(null);
  let avatarFile = $state<File | null>(null);
  let bannerPreview = $state<string | null>(null);
  let bannerFile = $state<File | null>(null);
  let uploadingAvatar = $state(false);
  let fileInput: HTMLInputElement | null = $state(null);
  let bannerFileInput: HTMLInputElement | null = $state(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  $effect(() => {
    if (open && $currentUser) {
      displayName = $currentUser.displayName ?? $currentUser.display_name ?? $currentUser.username ?? '';
      status = $currentUser.status ?? '';
      avatarPreview = null;
      avatarFile = null;
      bannerPreview = null;
      bannerFile = null;
      error = '';
    }
  });

  let currentAvatarUrl = $derived(
    $currentUser
      ? getFileDataUrl($currentUser.avatarFileId ?? $currentUser.avatar_file_id, $fileUploadsStore ?? [])
      : null
  );

  let currentBannerUrl = $derived(
    $currentUser
      ? getFileDataUrl($currentUser.bannerFileId ?? $currentUser.banner_file_id, $fileUploadsStore ?? [])
      : null
  );

  let hasBanner = $derived(!!(bannerPreview || currentBannerUrl));

  function handleFileSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error = 'Please select an image file';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      error = `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
      return;
    }

    error = '';
    avatarFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      avatarPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function handleBannerSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error = 'Please select an image file';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      error = `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
      return;
    }

    error = '';
    bannerFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      bannerPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveAvatar() {
    if (!avatarFile) return;
    uploadingAvatar = true;
    error = '';
    try {
      const buffer = await avatarFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await updateAvatar(bytes, avatarFile.type);
      avatarFile = null;
      avatarPreview = null;
    } catch (e: any) {
      error = e?.message ?? String(e);
    } finally {
      uploadingAvatar = false;
    }
  }

  async function handleSaveBanner() {
    if (!bannerFile) return;
    try {
      const buffer = await bannerFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await updateBanner(bytes, bannerFile.type);
      bannerFile = null;
      bannerPreview = null;
    } catch (e: any) {
      error = e?.message ?? String(e);
    }
  }

  async function handleRemoveAvatar() {
    uploadingAvatar = true;
    error = '';
    try {
      await removeAvatar();
      avatarPreview = null;
      avatarFile = null;
    } catch (e: any) {
      error = e?.message ?? String(e);
    } finally {
      uploadingAvatar = false;
    }
  }

  async function handleRemoveBanner() {
    error = '';
    try {
      await removeBanner();
      bannerPreview = null;
      bannerFile = null;
    } catch (e: any) {
      error = e?.message ?? String(e);
    }
  }

  async function handleSaveProfile() {
    saving = true;
    error = '';
    try {
      if (avatarFile) {
        await handleSaveAvatar();
      }
      if (bannerFile) {
        await handleSaveBanner();
      }
      await updateProfile(displayName, status);
      open = false;
    } catch (e: any) {
      error = e?.message ?? String(e);
    } finally {
      saving = false;
    }
  }

  async function handleLogout() {
    await logout();
    open = false;
    goto('/login');
  }

  function close() {
    open = false;
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onclick={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="bg-[#0f121a] border border-[#1b2230] rounded-2xl w-full max-w-md overflow-hidden" role="dialog" onclick={(e) => e.stopPropagation()}>
      <!-- Banner + Avatar wrapper -->
      <div class="relative">
        <!-- Banner -->
        <button
          onclick={() => bannerFileInput?.click()}
          class="h-24 w-full relative group cursor-pointer overflow-hidden"
          title="Change banner"
        >
          {#if bannerPreview}
            <img src={bannerPreview} alt="Banner preview" class="w-full h-full object-cover" />
          {:else if currentBannerUrl}
            <img src={currentBannerUrl} alt="Banner" class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full bg-gradient-to-r from-[#5865f2] to-[#7289da]"></div>
          {/if}
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="flex items-center gap-2 text-white text-sm font-medium">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              Change Banner
            </div>
          </div>
          <input
            bind:this={bannerFileInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            onchange={handleBannerSelect}
          />
        </button>
        <!-- Avatar -->
        <div class="absolute -bottom-10 left-6 z-10">
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            onclick={() => fileInput?.click()}
            class="w-20 h-20 rounded-full border-4 border-[#0f121a] bg-[#1b2230] flex items-center justify-center overflow-hidden group/avatar relative cursor-pointer"
            title="Change avatar"
            role="button"
            tabindex="0"
          >
            {#if avatarPreview}
              <img src={avatarPreview} alt="Avatar preview" class="w-full h-full object-cover" />
            {:else if currentAvatarUrl}
              <img src={currentAvatarUrl} alt="Avatar" class="w-full h-full object-cover" />
            {:else}
              <span class="text-2xl font-bold text-white">
                {($currentUser?.username ?? '?')[0]?.toUpperCase()}
              </span>
            {/if}
            <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-full">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
            </div>
          </div>
          <input
            bind:this={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            onchange={handleFileSelect}
          />
        </div>
      </div>

      <!-- Body -->
      <div class="pt-14 px-6 pb-6">
        <!-- Username display -->
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="text-lg font-bold text-[#e9eefc]">{$currentUser?.username ?? 'Unknown'}</span>
          {#if currentAvatarUrl || avatarPreview}
            <button
              onclick={handleRemoveAvatar}
              disabled={uploadingAvatar}
              class="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remove avatar
            </button>
          {/if}
          {#if hasBanner}
            <button
              onclick={handleRemoveBanner}
              disabled={saving}
              class="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Remove banner
            </button>
          {/if}
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} class="space-y-4 mt-4">
          <div>
            <label for="profileDisplayName" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
              Display Name
            </label>
            <input
              id="profileDisplayName"
              type="text"
              bind:value={displayName}
              maxlength={32}
              placeholder="How others see you"
              class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-2.5 outline-none focus:border-[#5865f2] transition-colors text-sm"
            />
          </div>

          <div>
            <label for="profileStatus" class="block text-xs font-semibold text-[#8b95a8] uppercase tracking-wide mb-2">
              Status
            </label>
            <input
              id="profileStatus"
              type="text"
              bind:value={status}
              maxlength={128}
              placeholder="What are you up to?"
              class="w-full bg-[#080a0f] border border-[#1b2230] text-[#e9eefc] rounded-lg px-4 py-2.5 outline-none focus:border-[#5865f2] transition-colors text-sm"
            />
          </div>

          {#if error}
            <p class="text-sm text-red-400">{error}</p>
          {/if}

          <div class="flex items-center justify-between pt-2">
            <button
              type="button"
              onclick={handleLogout}
              class="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Log Out
            </button>
            <div class="flex gap-3">
              <button
                type="button"
                onclick={close}
                class="px-4 py-2 text-sm text-[#8b95a8] hover:text-[#e9eefc] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploadingAvatar || !displayName.trim()}
                class="px-6 py-2 bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving || uploadingAvatar ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}
