<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    size?: number;
    stroke?: number;
  }>(),
  { size: 20, stroke: 1.7 },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'cursor'">
      <path d="M5.2 3.8 18 11.7l-6.1 1.4-3.2 5.4Z" />
    </template>
    <template v-else-if="name === 'rect'">
      <rect x="3.2" y="5" width="17.6" height="14" rx="1.4" />
    </template>
    <template v-else-if="name === 'ellipse'">
      <ellipse cx="12" cy="12" rx="8.8" ry="6.8" />
    </template>
    <template v-else-if="name === 'wall'">
      <path d="M3 7h18M3 17h18" />
      <path d="M7 7v10M13 7v10M18 7v10" opacity=".55" />
    </template>
    <template v-else-if="name === 'door'">
      <path d="M5 20V4.5h13V20" />
      <path d="M8 20V7h7v13" opacity=".55" />
      <circle cx="13" cy="13.4" r=".8" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'window'">
      <rect x="4" y="4.5" width="16" height="15" rx="1" />
      <path d="M12 4.5v15M4 12h16" />
    </template>
    <template v-else-if="name === 'sofa'">
      <path d="M5 11V8.2c0-1.2.8-2 2-2h10c1.2 0 2 .8 2 2V11" />
      <path d="M4.2 11.5c1.3 0 2.2.9 2.2 2.2v1.2h11.2v-1.2c0-1.3.9-2.2 2.2-2.2 1.4 0 2.2.9 2.2 2.2v4.1H2v-4.1c0-1.3.8-2.2 2.2-2.2Z" />
      <path d="M8 15v2M16 15v2" opacity=".55" />
    </template>
    <template v-else-if="name === 'table'">
      <rect x="3.5" y="6" width="17" height="4.2" rx="1" />
      <path d="M6 10.2V19M18 10.2V19M6 15h12" opacity=".7" />
    </template>
    <template v-else-if="name === 'bed'">
      <path d="M3 19V8m0 7h18v4M3 15V9.5c0-.8.7-1.5 1.5-1.5H11v7" />
      <path d="M13 10.5h6.5c.8 0 1.5.7 1.5 1.5v3" opacity=".65" />
      <path d="M5.5 10.8h3.8" />
    </template>
    <template v-else-if="name === 'cabinet'">
      <rect x="4" y="3.5" width="16" height="17" rx="1.3" />
      <path d="M12 3.5v17M4 11h16" opacity=".55" />
      <path d="M9.8 8.2v1.4M14.2 8.2v1.4M9.8 14.5v1.4M14.2 14.5v1.4" />
    </template>
    <template v-else-if="name === 'nightstand'">
      <rect x="5" y="4" width="14" height="16" rx="1.3" />
      <path d="M5 9.5h14M5 15h14" />
      <circle cx="9.3" cy="6.8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="9.3" cy="12.2" r=".7" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.7" cy="10.7" r="6.5" />
      <path d="m15.6 15.6 4.2 4.2" />
    </template>
    <template v-else-if="name === 'undo'">
      <path d="M9 7 4.5 11.5 9 16" />
      <path d="M4.8 11.5h8.6a5.2 5.2 0 0 1 0 10.4H9" />
    </template>
    <template v-else-if="name === 'redo'">
      <path d="m15 7 4.5 4.5L15 16" />
      <path d="M19.2 11.5h-8.6a5.2 5.2 0 0 0 0 10.4H15" />
    </template>
    <template v-else-if="name === '2d'">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" opacity=".45" />
      <path d="M12 12h6v6h-6z" />
    </template>
    <template v-else-if="name === '3d'">
      <path d="m12 2.8 8 4.4v9.6l-8 4.4-8-4.4V7.2Z" />
      <path d="m4 7.2 8 4.4 8-4.4M12 11.6v9.6" />
    </template>
    <template v-else-if="name === 'trash'">
      <path d="M4 7h16M9 7V4.8h6V7M6.5 7l.9 12.2h9.2L17.5 7" />
      <path d="M10 11v4M14 11v4" opacity=".55" />
    </template>
    <template v-else-if="name === 'locate'">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m6 6 12 12M18 6 6 18" />
    </template>
    <template v-else-if="name === 'arrow-right'">
      <path d="M4 12h15M14 7l5 5-5 5" />
    </template>
    <template v-else-if="name === 'rotate'">
      <path d="M20 7v5h-5" />
      <path d="M19.2 12a7.3 7.3 0 1 1-2.4-5.4L20 9.5" />
    </template>
    <template v-else-if="name === 'users'">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.9M17 14.8c2.2.5 3.7 2.3 3.7 4.6" opacity=".7" />
    </template>
    <template v-else-if="name === 'cloud'">
      <path d="M6.5 18.5A4.2 4.2 0 0 1 6 10.2a6 6 0 0 1 11.5.8 3.8 3.8 0 0 1-.5 7.5Z" />
      <path d="m9.5 14.3 1.8 1.8 3.4-3.5" />
    </template>
    <template v-else-if="name === 'cloud-off'">
      <path d="M6.5 18.5A4.2 4.2 0 0 1 6 10.2a6 6 0 0 1 9.8-2.1M18.8 11.5a3.8 3.8 0 0 1-1.3 7H10" />
      <path d="m3 3 18 18" />
    </template>
    <template v-else-if="name === 'zoom-in'">
      <circle cx="10.5" cy="10.5" r="6.3" />
      <path d="m15.2 15.2 4.5 4.5M10.5 7.6v5.8M7.6 10.5h5.8" />
    </template>
    <template v-else-if="name === 'zoom-out'">
      <circle cx="10.5" cy="10.5" r="6.3" />
      <path d="m15.2 15.2 4.5 4.5M7.6 10.5h5.8" />
    </template>
    <template v-else-if="name === 'fit'">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      <rect x="9" y="9" width="6" height="6" rx="1" opacity=".55" />
    </template>
    <template v-else-if="name === 'help'">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.7v.3" />
      <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'box'">
      <path d="m12 3 7.5 4.2v9.6L12 21l-7.5-4.2V7.2Z" />
      <path d="m4.7 7.3 7.3 4.1 7.3-4.1M12 11.4v9.4" opacity=".65" />
    </template>
    <template v-else-if="name === 'pin'">
      <path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z" />
      <circle cx="12" cy="10" r="2.3" />
    </template>
    <template v-else-if="name === 'layers'">
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" opacity=".6" />
    </template>
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r=".9" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m5 12.5 4.2 4.2L19 6.5" />
    </template>
    <template v-else-if="name === 'spark'">
      <path d="M12 3.5c.6 4.3 2.2 6 6.5 6.5-4.3.6-6 2.2-6.5 6.5-.6-4.3-2.2-6-6.5-6.5 4.3-.6 6-2.2 6.5-6.5Z" />
      <path d="M18.5 16.5c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z" opacity=".7" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8" />
    </template>
  </svg>
</template>
