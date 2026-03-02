<script lang="ts">
  import { fileUploadsStore, getFileDataUrl } from '$lib/stdb';

  let { user, size = 'md' }: { user: any; size?: 'sm' | 'md' | 'lg' } = $props();

  const sizeClasses: Record<string, string> = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm',
    lg: 'w-20 h-20 text-2xl',
  };

  let avatarUrl = $derived(
    user
      ? getFileDataUrl(user.avatarFileId ?? user.avatar_file_id, $fileUploadsStore ?? [])
      : null
  );

  let initial = $derived((user?.username ?? '?')[0]?.toUpperCase() ?? '?');
</script>

<div class="rounded-full bg-[#5865f2] flex items-center justify-center font-semibold text-white flex-shrink-0 overflow-hidden {sizeClasses[size]}">
  {#if avatarUrl}
    <img src={avatarUrl} alt="{user?.username ?? 'User'}" class="w-full h-full object-cover" />
  {:else}
    {initial}
  {/if}
</div>
