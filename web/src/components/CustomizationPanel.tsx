import React, { useEffect, useRef, useState } from 'react';

interface CustomizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  me: any;
}

const PRESET_COLORS = [
  { name: 'IMX Teal', accent: '#0d9488', bg: '#090b0e', bg2: '#12161c' },
  { name: 'Telegram', accent: '#0088cc', bg: '#0e1621', bg2: '#17212b' },
  { name: 'WhatsApp', accent: '#00a884', bg: '#0b141a', bg2: '#111b21' },
  { name: 'Slack', accent: '#611f69', bg: '#1a1d21', bg2: '#222529' },
  { name: 'Instagram', accent: '#e1306c', bg: '#121212', bg2: '#1e1e1e' },
  { name: 'Matrix', accent: '#0dbd8b', bg: '#0e1525', bg2: '#15192a' },
  { name: 'Nord', accent: '#88c0d0', bg: '#2e3440', bg2: '#3b4252' },
  { name: 'Dracula', accent: '#bd93f9', bg: '#282a36', bg2: '#44475a' },
  { name: 'Solarized', accent: '#268bd2', bg: '#002b36', bg2: '#073642' },
  { name: 'Gruvbox', accent: '#b8bb26', bg: '#282828', bg2: '#3c3836' },
];

const LIGHT_PRESET_COLORS = [
  { name: 'Mist', accent: '#0f766e', bg: '#e8ecf1', bg2: '#ffffff' },
  { name: 'Soft Blue', accent: '#0088cc', bg: '#e8f4fd', bg2: '#ffffff' },
  { name: 'Warm', accent: '#e67e22', bg: '#fdf6ec', bg2: '#ffffff' },
  { name: 'Mint', accent: '#00a884', bg: '#e6f9f3', bg2: '#ffffff' },
  { name: 'Lavender', accent: '#7c3aed', bg: '#f3eefa', bg2: '#ffffff' },
];

const FONT_OPTIONS = [
  { name: 'Outfit', value: "'Outfit', system-ui, sans-serif" },
  { name: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Poppins', value: "'Poppins', sans-serif" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
];

const CUSTOM_PROPS = [
  '--accent', '--mine', '--bg', '--bg-2', '--surface', '--text', '--muted',
  '--r-md', '--r-avatar', '--font', '--font-size', '--sidebar-w',
];

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

type Settings = Record<string, any>;

function loadSettings(): Settings {
  try {
    return JSON.parse(localStorage.getItem('imx_custom') || '{}');
  } catch {
    return {};
  }
}

function persistSettings(next: Settings): string | null {
  try {
    localStorage.setItem('imx_custom', JSON.stringify(next));
    return null;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      return 'Storage is full. Try a smaller logo or reset settings.';
    }
    return 'Could not save settings.';
  }
}

export function clearCustomProperties() {
  const root = document.documentElement;
  for (const key of CUSTOM_PROPS) root.style.removeProperty(key);
  document.body.style.removeProperty('font-size');
}

export function applySavedCustomProperties() {
  applyAllSettings(loadSettings());
}

function applySetting(key: string, value: any) {
  const root = document.documentElement;
  switch (key) {
    case 'accentColor':
      root.style.setProperty('--accent', value);
      root.style.setProperty('--mine', value);
      break;
    case 'bgColor':
      root.style.setProperty('--bg', value);
      break;
    case 'bg2Color':
      root.style.setProperty('--bg-2', value);
      break;
    case 'surfaceColor':
      root.style.setProperty('--surface', value);
      break;
    case 'textColor':
      root.style.setProperty('--text', value);
      break;
    case 'mutedColor':
      root.style.setProperty('--muted', value);
      break;
    case 'borderRadius':
      root.style.setProperty('--r-md', value + 'px');
      root.style.setProperty('--r-avatar', value + 'px');
      break;
    case 'fontFamily':
      root.style.setProperty('--font', value);
      break;
    case 'fontSize':
      root.style.setProperty('--font-size', value + 'px');
      document.body.style.fontSize = value + 'px';
      break;
    case 'sidebarWidth':
      root.style.setProperty('--sidebar-w', value + 'px');
      break;
    case 'avatarRadius':
      root.style.setProperty('--r-avatar', value + 'px');
      break;
    case 'logoUrl': {
      const marks = document.querySelectorAll('.logo-mark, .boot-mark');
      marks.forEach((el) => {
        (el as HTMLElement).style.backgroundImage = value ? `url(${value})` : '';
        (el as HTMLElement).style.backgroundSize = 'cover';
      });
      break;
    }
    case 'logoText': {
      const brands = document.querySelectorAll('.brand');
      brands.forEach((el) => {
        el.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === 'IMX') {
            node.textContent = ' ' + (value || 'IMX');
          }
        });
      });
      break;
    }
  }
}

function applyAllSettings(saved: Settings) {
  Object.entries(saved).forEach(([key, value]) => applySetting(key, value));
}

function textColorForBg(hex: string): string {
  const raw = hex.replace('#', '');
  if (raw.length < 6) return '#e4e6eb';
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1d27' : '#e4e6eb';
}

function cssVarFallback(key: string): string {
  const map: Record<string, string> = {
    accentColor: '--accent',
    bgColor: '--bg',
    bg2Color: '--bg-2',
    surfaceColor: '--surface',
    textColor: '--text',
    mutedColor: '--muted',
  };
  return getComputedStyle(document.documentElement).getPropertyValue(map[key] ?? '').trim() || '#000';
}

export function CustomizationPanel({ isOpen, onClose, me }: CustomizationPanelProps) {
  const [activeTab, setActiveTab] = useState<'colors' | 'layout' | 'messages' | 'logo' | 'advanced'>('colors');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains('light'));
  const logoInput = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new MutationObserver(() => setIsLight(document.documentElement.classList.contains('light')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setConfirmReset(false);
      return;
    }
    const root = sheetRef.current;
    const prev = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [isOpen, onClose]);

  const commit = (next: Settings, patch?: Settings) => {
    setSettings(next);
    const err = persistSettings(next);
    setStorageError(err);
    Object.entries(patch ?? next).forEach(([key, value]) => applySetting(key, value));
  };

  const update = (key: string, value: any) => {
    commit({ ...settings, [key]: value }, { [key]: value });
  };

  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    const patch = { accentColor: preset.accent, bgColor: preset.bg, bg2Color: preset.bg2 };
    commit({ ...settings, ...patch }, patch);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStorageError('Please choose an image file (PNG, JPEG, WebP, or GIF).');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setStorageError('Logo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      update('logoUrl', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const resetAll = () => {
    localStorage.removeItem('imx_custom');
    location.reload();
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'colors' as const, label: 'Colors', icon: '🎨' },
    { id: 'layout' as const, label: 'Layout', icon: '📐' },
    { id: 'messages' as const, label: 'Messages', icon: '💬' },
    { id: 'logo' as const, label: 'Logo', icon: '✨' },
    { id: 'advanced' as const, label: 'Advanced', icon: '⚙️' },
  ];

  const presets = isLight ? LIGHT_PRESET_COLORS : PRESET_COLORS;
  const sidebarWidth = settings.sidebarWidth ?? 380;
  const borderRadius = settings.borderRadius ?? 12;
  const avatarRadius = settings.avatarRadius ?? 12;
  const fontSize = settings.fontSize ?? 14;

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet wide custom-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-head">
          <h2 id="custom-title">Customize IMX</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="custom-tabs" role="tablist" aria-label="Customization sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`custom-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {storageError && <div className="banner error" role="alert">{storageError}</div>}

        {activeTab === 'colors' && (
          <div className="custom-section">
            <div>
              <h3>Preset Themes</h3>
              <div className="preset-grid">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    className="preset-tile"
                    onClick={() => applyPreset(p)}
                    style={{
                      borderColor: settings.accentColor === p.accent ? p.accent : undefined,
                      borderWidth: settings.accentColor === p.accent ? 2 : undefined,
                      background: p.bg,
                      color: textColorForBg(p.bg),
                    }}
                  >
                    <div className="preset-dot" style={{ background: p.accent }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3>Custom Colors</h3>
              <div className="color-grid">
                {[
                  { key: 'accentColor', label: 'Accent' },
                  { key: 'bgColor', label: 'Background' },
                  { key: 'bg2Color', label: 'Background 2' },
                  { key: 'surfaceColor', label: 'Surface' },
                  { key: 'textColor', label: 'Text' },
                  { key: 'mutedColor', label: 'Muted' },
                ].map((c) => (
                  <label key={c.key} className="color-field">
                    <input
                      type="color"
                      value={settings[c.key] || cssVarFallback(c.key)}
                      onChange={(e) => update(c.key, e.target.value)}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="custom-section">
            <label className="slider-field">
              Sidebar Width
              <div className="slider-row">
                <input
                  type="range"
                  min={260}
                  max={500}
                  value={sidebarWidth}
                  onChange={(e) => update('sidebarWidth', Number(e.target.value))}
                />
                <span>{sidebarWidth}px</span>
              </div>
            </label>

            <label className="slider-field">
              Border Radius
              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={borderRadius}
                  onChange={(e) => update('borderRadius', Number(e.target.value))}
                />
                <span>{borderRadius}px</span>
              </div>
            </label>

            <label className="slider-field">
              Avatar Radius
              <div className="slider-row">
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={avatarRadius}
                  onChange={(e) => update('avatarRadius', Number(e.target.value))}
                />
                <span>{avatarRadius}px</span>
              </div>
              <span className="hint">0 = square, 24 = round</span>
            </label>

            <label className="slider-field">
              Font Size
              <div className="slider-row">
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={fontSize}
                  onChange={(e) => update('fontSize', Number(e.target.value))}
                />
                <span>{fontSize}px</span>
              </div>
            </label>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="custom-section">
            <label className="slider-field">
              Font Family
              <select
                className="select-input"
                value={settings.fontFamily || FONT_OPTIONS[0].value}
                onChange={(e) => update('fontFamily', e.target.value)}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.name} value={f.value} style={{ fontFamily: f.value }}>{f.name}</option>
                ))}
              </select>
            </label>

            <div className="custom-preview">
              <h3>Preview</h3>
              <div className="preview-stack">
                <div className="preview-bubble theirs" style={{ fontSize }}>
                  This is a received message
                </div>
                <div className="preview-bubble mine" style={{ fontSize }}>
                  This is a sent message
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logo' && (
          <div className="custom-section">
            <div>
              <h3>App Name</h3>
              <input
                type="text"
                value={settings.logoText || 'IMX'}
                onChange={(e) => update('logoText', e.target.value)}
                placeholder="IMX"
              />
            </div>

            <div>
              <h3>Logo Image</h3>
              <div className="logo-row">
                <div
                  className="logo-preview"
                  style={settings.logoUrl ? { backgroundImage: `url(${settings.logoUrl})`, backgroundSize: 'cover' } : undefined}
                >
                  {!settings.logoUrl && <span>{(settings.logoText || 'IMX')[0]}</span>}
                </div>
                <div>
                  <button className="btn" onClick={() => logoInput.current?.click()}>
                    Upload Logo
                  </button>
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/*" onChange={handleLogoUpload} hidden />
                  {settings.logoUrl && (
                    <button className="btn danger" onClick={() => update('logoUrl', '')}>
                      Remove
                    </button>
                  )}
                  <p className="hint">Recommended: 256x256px PNG, max 2MB</p>
                </div>
              </div>
            </div>

            <div>
              <h3>Preset Logos</h3>
              <div className="emoji-logo-grid">
                {['🚀', '💎', '🔥', '⚡', '🌟', '🎯', '🎮', '💬', '🔔', '🛡️'].map((emoji) => (
                  <button
                    key={emoji}
                    className="emoji-logo-btn"
                    onClick={() => {
                      const canvas = document.createElement('canvas');
                      canvas.width = 128;
                      canvas.height = 128;
                      const ctx = canvas.getContext('2d')!;
                      ctx.fillStyle = settings.accentColor || '#0d9488';
                      ctx.beginPath();
                      ctx.roundRect(0, 0, 128, 128, 24);
                      ctx.fill();
                      ctx.font = '64px serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(emoji, 64, 64);
                      update('logoUrl', canvas.toDataURL());
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && (
          <div className="custom-section">
            <div className="custom-preview">
              <h3>Export Settings</h3>
              <p className="hint">Copy your customization settings to share or backup.</p>
              <button className="btn" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
                alert('Settings copied to clipboard!');
              }}>
                Copy Settings JSON
              </button>
            </div>

            <div className="custom-preview">
              <h3>Import Settings</h3>
              <textarea
                placeholder="Paste settings JSON here..."
                rows={4}
                onBlur={(e) => {
                  try {
                    const data = JSON.parse(e.target.value);
                    applyAllSettings(data);
                    setSettings(data);
                    setStorageError(persistSettings(data));
                  } catch {}
                }}
              />
            </div>

            <div className="danger-zone">
              <h3>Reset Everything</h3>
              <p className="hint">Restore all settings to default.</p>
              {confirmReset ? (
                <div className="confirm-bar">
                  <span>Reset all customization?</span>
                  <button className="btn danger" onClick={resetAll}>Yes, reset</button>
                  <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn danger" onClick={() => setConfirmReset(true)}>
                  Reset to Default
                </button>
              )}
            </div>
          </div>
        )}

        <div className="custom-footer">
          {confirmReset ? (
            <button className="btn danger" onClick={resetAll}>Yes, reset</button>
          ) : (
            <button className="btn danger" onClick={() => setConfirmReset(true)}>Reset</button>
          )}
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
