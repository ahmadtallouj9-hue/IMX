import React, { useState, useRef } from 'react';
import { api } from '../lib/api';

interface CustomizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  me: any;
}

const PRESET_COLORS = [
  { name: 'Discord Blue', accent: '#5865f2', bg: '#1a1a2e', bg2: '#16213e' },
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
  { name: 'Clean White', accent: '#5865f2', bg: '#f0f2f5', bg2: '#ffffff' },
  { name: 'Soft Blue', accent: '#0088cc', bg: '#e8f4fd', bg2: '#ffffff' },
  { name: 'Warm', accent: '#e67e22', bg: '#fdf6ec', bg2: '#ffffff' },
  { name: 'Mint', accent: '#00a884', bg: '#e6f9f3', bg2: '#ffffff' },
  { name: 'Lavender', accent: '#7c3aed', bg: '#f3eefa', bg2: '#ffffff' },
];

const FONT_OPTIONS = [
  { name: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { name: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Poppins', value: "'Poppins', sans-serif" },
  { name: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
];

export function CustomizationPanel({ isOpen, onClose, me }: CustomizationPanelProps) {
  const [activeTab, setActiveTab] = useState<'colors' | 'layout' | 'messages' | 'logo' | 'advanced'>('colors');
  const [settings, setSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('imx_custom') || '{}');
    } catch { return {}; }
  });
  const logoInput = useRef<HTMLInputElement>(null);

  const update = (key: string, value: any) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    localStorage.setItem('imx_custom', JSON.stringify(next));
    applySetting(key, value);
  };

  const applySetting = (key: string, value: any) => {
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
      case 'logoUrl':
        const marks = document.querySelectorAll('.logo-mark, .boot-mark');
        marks.forEach(el => {
          (el as HTMLElement).style.backgroundImage = value ? `url(${value})` : '';
          (el as HTMLElement).style.backgroundSize = 'cover';
        });
        break;
      case 'logoText':
        const brands = document.querySelectorAll('.brand');
        brands.forEach(el => {
          el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === 'IMX') {
              node.textContent = ' ' + (value || 'IMX');
            }
          });
        });
        break;
    }
  };

  const applyPreset = (preset: typeof PRESET_COLORS[0]) => {
    update('accentColor', preset.accent);
    update('bgColor', preset.bg);
    update('bg2Color', preset.bg2);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      update('logoUrl', dataUrl);
      const marks = document.querySelectorAll('.logo-mark, .boot-mark');
      marks.forEach(el => {
        (el as HTMLElement).style.backgroundImage = `url(${dataUrl})`;
        (el as HTMLElement).style.backgroundSize = 'cover';
        (el as HTMLElement).style.background = 'none';
      });
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

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet wide" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '85vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Customize IMX</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 'var(--r-sm)',
                border: 'none', background: activeTab === t.id ? 'var(--accent-soft)' : 'transparent',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--muted)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Colors Tab */}
        {activeTab === 'colors' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Preset Themes</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {PRESET_COLORS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      border: settings.accentColor === p.accent ? `2px solid ${p.accent}` : '1px solid var(--line)',
                      background: p.bg, color: '#e8eaed',
                      cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600,
                    }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: p.accent, marginBottom: 6 }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Custom Colors</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { key: 'accentColor', label: 'Accent' },
                  { key: 'bgColor', label: 'Background' },
                  { key: 'bg2Color', label: 'Background 2' },
                  { key: 'surfaceColor', label: 'Surface' },
                  { key: 'textColor', label: 'Text' },
                  { key: 'mutedColor', label: 'Muted' },
                ].map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', fontSize: '0.85rem' }}>
                    <input
                      type="color"
                      value={settings[c.key] || getComputedStyle(document.documentElement).getPropertyValue(`--${c.key.replace('Color', '').replace('accent', 'accent').replace('bg2', 'bg-2').replace('bg', 'bg').replace('surface', 'surface').replace('text', 'text').replace('muted', 'muted')}`).trim() || '#000'}
                      onChange={(e) => update(c.key, e.target.value)}
                      style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 4 }}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Sidebar Width
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={260}
                  max={500}
                  value={settings.sidebarWidth || 380}
                  onChange={(e) => update('sidebarWidth', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 600, minWidth: 40 }}>{settings.sidebarWidth || 380}px</span>
              </div>
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Border Radius
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={settings.borderRadius || 14}
                  onChange={(e) => update('borderRadius', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 600, minWidth: 40 }}>{settings.borderRadius || 14}px</span>
              </div>
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Avatar Radius
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={0}
                  max={24}
                  value={settings.avatarRadius || 12}
                  onChange={(e) => update('avatarRadius', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 600, minWidth: 40 }}>{settings.avatarRadius || 12}px</span>
              </div>
              <span style={{ fontSize: '0.75rem' }}>0 = square, 24 = round</span>
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Font Size
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={settings.fontSize || 15}
                  onChange={(e) => update('fontSize', Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 600, minWidth: 40 }}>{settings.fontSize || 15}px</span>
              </div>
            </label>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Font Family
              <select
                value={settings.fontFamily || FONT_OPTIONS[0].value}
                onChange={(e) => update('fontFamily', e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: '0.9rem',
                }}
              >
                {FONT_OPTIONS.map(f => (
                  <option key={f.name} value={f.value} style={{ fontFamily: f.value }}>{f.name}</option>
                ))}
              </select>
            </label>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: 'var(--muted)' }}>Preview</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ background: 'var(--theirs)', padding: '8px 12px', borderRadius: 'var(--r-md)', maxWidth: '70%', fontSize: settings.fontSize || 15 }}>
                  This is a received message
                </div>
                <div style={{ background: 'var(--mine)', padding: '8px 12px', borderRadius: 'var(--r-md)', maxWidth: '70%', marginLeft: 'auto', color: '#fff', fontSize: settings.fontSize || 15 }}>
                  This is a sent message
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logo Tab */}
        {activeTab === 'logo' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>App Name</h3>
              <input
                type="text"
                value={settings.logoText || 'IMX'}
                onChange={(e) => update('logoText', e.target.value)}
                placeholder="IMX"
                style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Logo Image</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 'var(--r-sm)',
                  background: settings.logoUrl ? `url(${settings.logoUrl}) center/cover` : 'var(--accent)',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  border: '1px solid var(--line)',
                }}>
                  {!settings.logoUrl && <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>{(settings.logoText || 'IMX')[0]}</span>}
                </div>
                <div>
                  <button className="btn" onClick={() => logoInput.current?.click()} style={{ marginBottom: 4 }}>
                    Upload Logo
                  </button>
                  <input ref={logoInput} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  {settings.logoUrl && (
                    <button className="btn danger" onClick={() => update('logoUrl', '')} style={{ marginLeft: 8 }}>
                      Remove
                    </button>
                  )}
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>Recommended: 256x256px PNG</p>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Preset Logos</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['🚀', '💎', '🔥', '⚡', '🌟', '🎯', '🎮', '💬', '🔔', '🛡️'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => {
                      const canvas = document.createElement('canvas');
                      canvas.width = 128; canvas.height = 128;
                      const ctx = canvas.getContext('2d')!;
                      ctx.fillStyle = settings.accentColor || '#5865f2';
                      ctx.beginPath();
                      ctx.roundRect(0, 0, 128, 128, 24);
                      ctx.fill();
                      ctx.font = '64px serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(emoji, 64, 64);
                      update('logoUrl', canvas.toDataURL());
                    }}
                    style={{
                      width: 48, height: 48, fontSize: '1.5rem',
                      borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
                      background: 'var(--surface)', cursor: 'pointer',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)' }}>Export Settings</h3>
              <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--muted)' }}>Copy your customization settings to share or backup.</p>
              <button className="btn" onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
                alert('Settings copied to clipboard!');
              }}>
                Copy Settings JSON
              </button>
            </div>

            <div style={{ padding: 16, background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--muted)' }}>Import Settings</h3>
              <textarea
                placeholder="Paste settings JSON here..."
                rows={4}
                style={{ marginBottom: 8 }}
                onBlur={(e) => {
                  try {
                    const data = JSON.parse(e.target.value);
                    Object.entries(data).forEach(([k, v]) => applySetting(k, v as any));
                    setSettings(data);
                    localStorage.setItem('imx_custom', JSON.stringify(data));
                  } catch {}
                }}
              />
            </div>

            <div style={{ padding: 16, background: 'var(--danger-soft)', borderRadius: 'var(--r-md)', border: '1px solid rgba(237,66,69,0.2)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--danger)' }}>Reset Everything</h3>
              <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--muted)' }}>Restore all settings to default.</p>
              <button className="btn danger" onClick={resetAll}>
                Reset to Default
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <button className="btn danger" onClick={resetAll}>Reset</button>
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
