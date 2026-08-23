/** Shared IMX appearance theme — load/save/apply for the whole app. */

export type CustomSettings = {
  accent?: string;
  accent2?: string;
  bg?: string;
  bg2?: string;
  surface?: string;
  text?: string;
  muted?: string;
  line?: string;
  mine?: string;
  theirs?: string;
  danger?: string;
  success?: string;
  radius?: number;
  shellRadius?: number;
  avatarRadius?: number;
  avatarSize?: number;
  font?: string;
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  sidebarWidth?: number;
  headerHeight?: number;
  composerHeight?: number;
  bubbleMaxWidth?: number;
  density?: 'compact' | 'comfy' | 'roomy';
  bubbleStyle?: 'tail' | 'soft' | 'square' | 'pill';
  buttonStyle?: 'solid' | 'soft' | 'outline';
  bubbleShadow?: boolean;
  wallpaper?: string;
  reduceMotion?: boolean;
  messageAnim?: boolean;
  showTimestamps?: boolean;
  showAvatars?: boolean;
  showSenderNames?: boolean;
  compactComposer?: boolean;
  brandName?: string;
  logoUrl?: string;
};

export type ThemePreset = {
  name: string;
  accent: string;
  accent2?: string;
  bg: string;
  bg2: string;
  surface?: string;
  text?: string;
  muted?: string;
  line?: string;
  mine?: string;
  theirs?: string;
};

const STORAGE_KEY = 'imx.custom.v2';
const LEGACY_KEYS = ['imx_custom', 'imx.custom', 'cove.custom'];

export const CSS_KEYS = [
  '--accent', '--accent-hover', '--accent-soft', '--accent-ring', '--accent-2', '--accent-2-soft',
  '--mine', '--theirs', '--bg', '--bg-2', '--surface', '--surface-2',
  '--text', '--muted', '--muted-2', '--line', '--line-strong', '--line-soft',
  '--danger', '--danger-soft', '--success',
  '--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-xl', '--r-avatar', '--shell-radius',
  '--font', '--font-size', '--lh', '--tracking',
  '--sidebar-w', '--header-h', '--composer-h', '--avatar', '--icon',
  '--bubble-max', '--chat-wallpaper', '--chat-wallpaper-size',
  '--mesh-a', '--mesh-b', '--overlay-bg',
] as const;

export const DARK_PRESETS: ThemePreset[] = [
  { name: 'IMX Coral', accent: '#fb923c', accent2: '#2dd4bf', bg: '#0b0d10', bg2: '#14181f', surface: '#1c222c', text: '#f3f5f8', muted: '#939db0', line: '#2c3544', mine: '#c2410c', theirs: '#1c222c' },
  { name: 'Teal Night', accent: '#2dd4bf', accent2: '#38bdf8', bg: '#071016', bg2: '#0e1a22', surface: '#15242e', text: '#e8f4f2', muted: '#8aa4ad', line: '#1e3340', mine: '#0f766e', theirs: '#15242e' },
  { name: 'WhatsApp', accent: '#00a884', accent2: '#25d366', bg: '#0b141a', bg2: '#111b21', surface: '#202c33', text: '#e9edef', muted: '#8696a0', line: '#2a3942', mine: '#005c4b', theirs: '#202c33' },
  { name: 'Slack', accent: '#e01e5a', accent2: '#36c5f0', bg: '#1a1d21', bg2: '#222529', surface: '#2a2e33', text: '#f8f8f8', muted: '#ababad', line: '#3a3f45', mine: '#611f69', theirs: '#2a2e33' },
  { name: 'Nord', accent: '#88c0d0', accent2: '#a3be8c', bg: '#2e3440', bg2: '#3b4252', surface: '#434c5e', text: '#eceff4', muted: '#d8dee9', line: '#4c566a', mine: '#5e81ac', theirs: '#434c5e' },
  { name: 'Dracula', accent: '#bd93f9', accent2: '#ff79c6', bg: '#282a36', bg2: '#21222c', surface: '#44475a', text: '#f8f8f2', muted: '#6272a4', line: '#6272a4', mine: '#6272a4', theirs: '#44475a' },
  { name: 'Ember', accent: '#f97316', accent2: '#fbbf24', bg: '#120b08', bg2: '#1c100c', surface: '#2a1710', text: '#fff7ed', muted: '#c4a484', line: '#3b2418', mine: '#ea580c', theirs: '#2a1710' },
  { name: 'Midnight', accent: '#60a5fa', accent2: '#a78bfa', bg: '#070b16', bg2: '#0d1424', surface: '#162036', text: '#e8eefc', muted: '#8b9bb8', line: '#243352', mine: '#1d4ed8', theirs: '#162036' },
  { name: 'Moss', accent: '#4ade80', accent2: '#a3e635', bg: '#07140c', bg2: '#0d1c12', surface: '#15271b', text: '#ecfdf3', muted: '#86a891', line: '#1f3a28', mine: '#15803d', theirs: '#15271b' },
  { name: 'Rose', accent: '#fb7185', accent2: '#f472b6', bg: '#14080e', bg2: '#1c0e14', surface: '#2a1520', text: '#fff1f5', muted: '#c4a0ad', line: '#3b2030', mine: '#e11d48', theirs: '#2a1520' },
  { name: 'Graphite', accent: '#a1a1aa', accent2: '#fafafa', bg: '#09090b', bg2: '#18181b', surface: '#27272a', text: '#fafafa', muted: '#a1a1aa', line: '#3f3f46', mine: '#52525b', theirs: '#27272a' },
  { name: 'Ocean', accent: '#22d3ee', accent2: '#818cf8', bg: '#020617', bg2: '#0f172a', surface: '#1e293b', text: '#f8fafc', muted: '#94a3b8', line: '#334155', mine: '#0891b2', theirs: '#1e293b' },
];

export const LIGHT_PRESETS: ThemePreset[] = [
  { name: 'IMX Light', accent: '#e85d04', accent2: '#0f766e', bg: '#d7dde6', bg2: '#f7f8fb', surface: '#eef1f6', text: '#0c1118', muted: '#5b6778', line: '#c5ceda', mine: '#e85d04', theirs: '#ffffff' },
  { name: 'Mist Teal', accent: '#0f766e', accent2: '#0284c7', bg: '#e8ecf1', bg2: '#ffffff', surface: '#f1f5f9', text: '#0f172a', muted: '#64748b', line: '#cbd5e1', mine: '#0f766e', theirs: '#ffffff' },
  { name: 'Soft Blue', accent: '#2563eb', accent2: '#7c3aed', bg: '#e8eef8', bg2: '#ffffff', surface: '#eef2ff', text: '#0f172a', muted: '#64748b', line: '#c7d2fe', mine: '#2563eb', theirs: '#ffffff' },
  { name: 'Mint', accent: '#059669', accent2: '#0d9488', bg: '#e6f4ef', bg2: '#ffffff', surface: '#ecfdf5', text: '#052e16', muted: '#4d7c65', line: '#a7f3d0', mine: '#059669', theirs: '#ffffff' },
  { name: 'Sand', accent: '#c2410c', accent2: '#a16207', bg: '#ebe4d8', bg2: '#faf7f2', surface: '#f3eee6', text: '#1c140f', muted: '#7a6a5a', line: '#d6c7b4', mine: '#c2410c', theirs: '#ffffff' },
  { name: 'Lilac', accent: '#7c3aed', accent2: '#db2777', bg: '#e9e4f5', bg2: '#faf8ff', surface: '#f3effa', text: '#1e1233', muted: '#6b5f85', line: '#ddd6fe', mine: '#7c3aed', theirs: '#ffffff' },
  { name: 'Sky', accent: '#0284c7', accent2: '#0891b2', bg: '#dceaf5', bg2: '#f5fbff', surface: '#e8f3fb', text: '#0c1929', muted: '#5a738a', line: '#bae6fd', mine: '#0284c7', theirs: '#ffffff' },
  { name: 'Paper', accent: '#334155', accent2: '#0f766e', bg: '#e2e8f0', bg2: '#ffffff', surface: '#f1f5f9', text: '#0f172a', muted: '#64748b', line: '#cbd5e1', mine: '#334155', theirs: '#ffffff' },
  { name: 'Blush', accent: '#e11d48', accent2: '#db2777', bg: '#f3e8eb', bg2: '#fff7f9', surface: '#ffe4e6', text: '#4c0519', muted: '#9f1239', line: '#fecdd3', mine: '#e11d48', theirs: '#ffffff' },
  { name: 'Citrus', accent: '#ca8a04', accent2: '#65a30d', bg: '#f3eedc', bg2: '#fffbeb', surface: '#fef3c7', text: '#422006', muted: '#854d0e', line: '#fde68a', mine: '#ca8a04', theirs: '#ffffff' },
];

export const FONTS = [
  { name: 'Sora', value: "'Sora', system-ui, sans-serif" },
  { name: 'Poppins', value: "'Poppins', system-ui, sans-serif" },
  { name: 'Roboto', value: "'Roboto', system-ui, sans-serif" },
  { name: 'DM Sans', value: "'DM Sans', system-ui, sans-serif" },
  { name: 'Space Grotesk', value: "'Space Grotesk', system-ui, sans-serif" },
  { name: 'IBM Plex Sans', value: "'IBM Plex Sans', system-ui, sans-serif" },
  { name: 'Nunito', value: "'Nunito', system-ui, sans-serif" },
  { name: 'Outfit', value: "'Outfit', system-ui, sans-serif" },
  { name: 'Inter Tight', value: "'Inter Tight', system-ui, sans-serif" },
  { name: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', ui-monospace, monospace" },
];

export const WALLPAPERS: Array<{ name: string; value: string; size?: string }> = [
  { name: 'Dots', value: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--text) 6%, transparent) 1px, transparent 0)', size: '20px 20px' },
  { name: 'Grid', value: 'linear-gradient(color-mix(in srgb, var(--text) 5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text) 5%, transparent) 1px, transparent 1px)', size: '24px 24px' },
  { name: 'Cross', value: 'linear-gradient(45deg, color-mix(in srgb, var(--text) 4%, transparent) 25%, transparent 25%), linear-gradient(-45deg, color-mix(in srgb, var(--text) 4%, transparent) 25%, transparent 25%)', size: '18px 18px' },
  { name: 'Wash', value: 'radial-gradient(120% 80% at 10% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 55%), radial-gradient(90% 70% at 100% 100%, color-mix(in srgb, var(--accent-2) 14%, transparent), transparent 50%)', size: 'cover' },
  { name: 'Dawn', value: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 42%), linear-gradient(20deg, color-mix(in srgb, var(--accent-2) 12%, transparent), transparent 40%)', size: 'cover' },
  { name: 'Noir', value: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--text) 8%, transparent), transparent 55%)', size: 'cover' },
  { name: 'Ribbon', value: 'repeating-linear-gradient(-18deg, transparent, transparent 14px, color-mix(in srgb, var(--accent) 7%, transparent) 14px, color-mix(in srgb, var(--accent) 7%, transparent) 15px)', size: 'auto' },
  { name: 'None', value: 'none', size: 'auto' },
];

export const BUBBLE_STYLES = [
  { id: 'tail' as const, label: 'Tail' },
  { id: 'soft' as const, label: 'Soft' },
  { id: 'square' as const, label: 'Square' },
  { id: 'pill' as const, label: 'Pill' },
];

export const DENSITIES = [
  { id: 'compact' as const, label: 'Compact' },
  { id: 'comfy' as const, label: 'Comfy' },
  { id: 'roomy' as const, label: 'Roomy' },
];

export const BUTTON_STYLES = [
  { id: 'solid' as const, label: 'Solid' },
  { id: 'soft' as const, label: 'Soft' },
  { id: 'outline' as const, label: 'Outline' },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim();
  if (raw.length < 6) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function textOn(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#e4e6eb';
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.55 ? '#1a1d27' : '#e4e6eb';
}

export function readCss(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function migrateLegacy(parsed: Record<string, unknown>): CustomSettings {
  return {
    accent: (parsed.accentColor ?? parsed.accent) as string | undefined,
    accent2: parsed.accent2 as string | undefined,
    bg: (parsed.bgColor ?? parsed.bg) as string | undefined,
    bg2: (parsed.bg2Color ?? parsed.bg2) as string | undefined,
    surface: (parsed.surfaceColor ?? parsed.surface) as string | undefined,
    text: (parsed.textColor ?? parsed.text) as string | undefined,
    muted: (parsed.mutedColor ?? parsed.muted) as string | undefined,
    line: parsed.line as string | undefined,
    mine: parsed.mine as string | undefined,
    theirs: parsed.theirs as string | undefined,
    radius: (parsed.borderRadius ?? parsed.radius) as number | undefined,
    avatarRadius: parsed.avatarRadius as number | undefined,
    font: (parsed.fontFamily ?? parsed.font) as string | undefined,
    fontSize: parsed.fontSize as number | undefined,
    sidebarWidth: parsed.sidebarWidth as number | undefined,
    brandName: (parsed.logoText ?? parsed.brandName) as string | undefined,
    logoUrl: parsed.logoUrl as string | undefined,
    density: parsed.density as CustomSettings['density'],
    bubbleStyle: parsed.bubbleStyle as CustomSettings['bubbleStyle'],
    wallpaper: parsed.wallpaper as string | undefined,
  };
}

export function loadCustomSettings(): CustomSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CustomSettings;
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      return migrateLegacy(JSON.parse(legacy) as Record<string, unknown>);
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function persistCustomSettings(next: CustomSettings): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return null;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      return 'Storage is full. Try a smaller logo or reset.';
    }
    return 'Could not save settings.';
  }
}

export function clearStoredCustomSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
  for (const key of LEGACY_KEYS) localStorage.removeItem(key);
}

function applyBrandName(name: string) {
  const label = name.trim() || 'IMX';
  document.querySelectorAll('[data-brand-text], .brand-text, .auth-name, .welcome-brand').forEach((el) => {
    el.textContent = label;
  });
}

function applyLogo(url?: string) {
  document.querySelectorAll('.logo-mark, .boot-mark, [data-brand-mark]').forEach((el) => {
    const node = el as HTMLElement;
    if (url) {
      node.style.backgroundImage = `url(${url})`;
      node.style.backgroundSize = 'cover';
      node.style.backgroundPosition = 'center';
      node.classList.add('has-logo');
    } else {
      node.style.backgroundImage = '';
      node.classList.remove('has-logo');
    }
  });
}

export function clearCustomProperties(): void {
  const root = document.documentElement;
  for (const key of CSS_KEYS) root.style.removeProperty(key);
  root.removeAttribute('data-bubble');
  root.removeAttribute('data-density');
  root.removeAttribute('data-motion');
  root.removeAttribute('data-btn');
  root.classList.remove(
    'bubble-shadow-off',
    'hide-timestamps',
    'hide-avatars',
    'hide-sender-names',
    'compact-composer',
    'msg-anim-off',
  );
  document.body.style.removeProperty('font-size');
  applyBrandName('IMX');
  applyLogo(undefined);
}

export function applyCustomSettings(settings: CustomSettings): void {
  const root = document.documentElement;

  if (settings.accent) {
    root.style.setProperty('--accent', settings.accent);
    root.style.setProperty('--accent-hover', settings.accent);
    root.style.setProperty('--accent-soft', withAlpha(settings.accent, 0.14));
    root.style.setProperty('--accent-ring', withAlpha(settings.accent, 0.28));
    root.style.setProperty('--mesh-a', withAlpha(settings.accent, 0.18));
    if (!settings.mine) root.style.setProperty('--mine', settings.accent);
  }
  if (settings.accent2) {
    root.style.setProperty('--accent-2', settings.accent2);
    root.style.setProperty('--accent-2-soft', withAlpha(settings.accent2, 0.12));
    root.style.setProperty('--mesh-b', withAlpha(settings.accent2, 0.14));
  }
  if (settings.bg) root.style.setProperty('--bg', settings.bg);
  if (settings.bg2) root.style.setProperty('--bg-2', settings.bg2);
  if (settings.surface) {
    root.style.setProperty('--surface', settings.surface);
    root.style.setProperty('--surface-2', settings.surface);
  }
  if (settings.text) root.style.setProperty('--text', settings.text);
  if (settings.muted) {
    root.style.setProperty('--muted', settings.muted);
    root.style.setProperty('--muted-2', settings.muted);
  }
  if (settings.line) {
    root.style.setProperty('--line', settings.line);
    root.style.setProperty('--line-strong', settings.line);
    root.style.setProperty('--line-soft', withAlpha(settings.line, 0.55));
  }
  if (settings.mine) root.style.setProperty('--mine', settings.mine);
  if (settings.theirs) root.style.setProperty('--theirs', settings.theirs);
  if (settings.danger) {
    root.style.setProperty('--danger', settings.danger);
    root.style.setProperty('--danger-soft', withAlpha(settings.danger, 0.12));
  }
  if (settings.success) root.style.setProperty('--success', settings.success);

  if (typeof settings.radius === 'number') {
    root.style.setProperty('--r-xs', `${Math.max(2, settings.radius - 8)}px`);
    root.style.setProperty('--r-sm', `${Math.max(4, settings.radius - 4)}px`);
    root.style.setProperty('--r-md', `${settings.radius}px`);
    root.style.setProperty('--r-lg', `${settings.radius + 6}px`);
    root.style.setProperty('--r-xl', `${settings.radius + 12}px`);
  }
  if (typeof settings.shellRadius === 'number') {
    root.style.setProperty('--shell-radius', `${settings.shellRadius}px`);
  }
  if (typeof settings.avatarRadius === 'number') {
    root.style.setProperty('--r-avatar', settings.avatarRadius >= 24 ? '50%' : `${settings.avatarRadius}px`);
  }
  if (typeof settings.avatarSize === 'number') {
    root.style.setProperty('--avatar', `${settings.avatarSize}px`);
    root.style.setProperty('--icon', `${Math.max(32, settings.avatarSize - 4)}px`);
  }
  if (settings.font) root.style.setProperty('--font', settings.font);
  if (typeof settings.fontSize === 'number') {
    root.style.setProperty('--font-size', `${settings.fontSize}px`);
    document.body.style.fontSize = `${settings.fontSize}px`;
  }
  if (typeof settings.letterSpacing === 'number') {
    root.style.setProperty('--tracking', `${settings.letterSpacing}em`);
  }
  if (typeof settings.lineHeight === 'number') {
    root.style.setProperty('--lh', String(settings.lineHeight));
  }
  if (typeof settings.sidebarWidth === 'number') {
    root.style.setProperty('--sidebar-w', `${settings.sidebarWidth}px`);
  }
  if (typeof settings.headerHeight === 'number') {
    root.style.setProperty('--header-h', `${settings.headerHeight}px`);
  }
  if (typeof settings.composerHeight === 'number') {
    root.style.setProperty('--composer-h', `${settings.composerHeight}px`);
  }
  if (typeof settings.bubbleMaxWidth === 'number') {
    root.style.setProperty('--bubble-max', `${settings.bubbleMaxWidth}%`);
  }

  const wallpaper = WALLPAPERS.find((w) => w.name === (settings.wallpaper ?? 'Dots')) ?? WALLPAPERS[0];
  root.style.setProperty('--chat-wallpaper', wallpaper.value);
  root.style.setProperty('--chat-wallpaper-size', wallpaper.size ?? 'cover');

  root.setAttribute('data-bubble', settings.bubbleStyle ?? 'tail');
  root.setAttribute('data-density', settings.density ?? 'comfy');
  root.setAttribute('data-motion', settings.reduceMotion ? 'reduced' : 'full');
  root.setAttribute('data-btn', settings.buttonStyle ?? 'solid');
  root.classList.toggle('bubble-shadow-off', settings.bubbleShadow === false);
  root.classList.toggle('hide-timestamps', settings.showTimestamps === false);
  root.classList.toggle('hide-avatars', settings.showAvatars === false);
  root.classList.toggle('hide-sender-names', settings.showSenderNames === false);
  root.classList.toggle('compact-composer', settings.compactComposer === true);
  root.classList.toggle('msg-anim-off', settings.messageAnim === false);

  applyBrandName(settings.brandName || 'IMX');
  applyLogo(settings.logoUrl);
}

export function applySavedCustomProperties(): void {
  applyCustomSettings(loadCustomSettings());
}

export function presetToSettings(preset: ThemePreset): Partial<CustomSettings> {
  return {
    accent: preset.accent,
    accent2: preset.accent2,
    bg: preset.bg,
    bg2: preset.bg2,
    surface: preset.surface,
    text: preset.text,
    muted: preset.muted,
    line: preset.line,
    mine: preset.mine ?? preset.accent,
    theirs: preset.theirs,
  };
}
