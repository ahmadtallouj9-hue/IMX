import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  applyCustomSettings,
  applySavedCustomProperties,
  BUBBLE_STYLES,
  BUTTON_STYLES,
  clearCustomProperties,
  clearStoredCustomSettings,
  DARK_PRESETS,
  DENSITIES,
  FONTS,
  LIGHT_PRESETS,
  loadCustomSettings,
  persistCustomSettings,
  presetToSettings,
  readCss,
  textOn,
  WALLPAPERS,
  type CustomSettings,
  type ThemePreset,
} from '../lib/customTheme';

export { applySavedCustomProperties, clearCustomProperties };

type TabId = 'themes' | 'colors' | 'chat' | 'chrome' | 'type' | 'brand' | 'more';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  me?: { displayName?: string; username?: string } | null;
};

const LOGO_MAX = 2 * 1024 * 1024;
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value?: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-field">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span>{label}</span>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span>
          {unit === 'em' || unit === '' ? value.toFixed(unit === 'em' ? 3 : 2) : value}
          {unit}
        </span>
      </div>
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="chip-field">
      <span className="chip-label">{label}</span>
      <div className="chip-row" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`chip ${value === opt.id ? 'active' : ''}`}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <div>
        <strong>{label}</strong>
        {hint ? <span className="hint">{hint}</span> : null}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function CustomizationPanel({ isOpen, onClose, me }: Props) {
  const titleId = useId();
  const [tab, setTab] = useState<TabId>('themes');
  const [settings, setSettings] = useState<CustomSettings>(loadCustomSettings);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains('light'));
  const [importDraft, setImportDraft] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.classList.contains('light'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setConfirmReset(false);
      return;
    }
    setSettings(loadCustomSettings());
    const root = sheetRef.current;
    const prev = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const items = focusable();
      if (!items.length) return;
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

  if (!isOpen) return null;

  const commit = (next: CustomSettings) => {
    setSettings(next);
    setError(persistCustomSettings(next));
    applyCustomSettings(next);
  };

  const patch = (partial: Partial<CustomSettings>) => commit({ ...settings, ...partial });

  const applyPreset = (preset: ThemePreset) => patch(presetToSettings(preset));

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (PNG, JPEG, WebP, or GIF).');
      return;
    }
    if (file.size > LOGO_MAX) {
      setError('Logo must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ logoUrl: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  const makeEmojiLogo = (emoji: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = settings.accent || readCss('--accent', '#e85d04');
    ctx.beginPath();
    const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
    if (typeof anyCtx.roundRect === 'function') anyCtx.roundRect(0, 0, 128, 128, 28);
    else ctx.rect(0, 0, 128, 128);
    ctx.fill();
    ctx.font = '64px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 68);
    patch({ logoUrl: canvas.toDataURL('image/png') });
  };

  const resetAll = () => {
    clearStoredCustomSettings();
    clearCustomProperties();
    setSettings({});
    setConfirmReset(false);
    setError(null);
  };

  const presets = isLight ? LIGHT_PRESETS : DARK_PRESETS;
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'themes', label: 'Themes' },
    { id: 'colors', label: 'Colors' },
    { id: 'chat', label: 'Chat' },
    { id: 'chrome', label: 'Chrome' },
    { id: 'type', label: 'Type' },
    { id: 'brand', label: 'Brand' },
    { id: 'more', label: 'More' },
  ];

  const brand = settings.brandName || 'IMX';
  const density = settings.density ?? 'comfy';
  const bubbleStyle = settings.bubbleStyle ?? 'tail';
  const buttonStyle = settings.buttonStyle ?? 'solid';
  const wallpaper = settings.wallpaper ?? 'Dots';

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet custom-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="custom-head">
          <div>
            <p className="custom-kicker">Appearance</p>
            <h2 id={titleId}>Customize {brand}</h2>
            <p className="hint">
              {me?.displayName ? `Signed in as ${me.displayName}` : 'Every surface — make it yours.'}
            </p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="custom-tabs" role="tablist" aria-label="Customization sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`custom-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="custom-body">
          {error ? (
            <div className="banner error" role="alert">
              {error}
            </div>
          ) : null}

          {tab === 'themes' && (
            <section className="custom-section">
              <Section title={isLight ? 'Light presets' : 'Dark presets'}>
                <div className="preset-grid">
                  {presets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={`preset-tile ${settings.accent === preset.accent ? 'active' : ''}`}
                      style={{ background: preset.bg2, color: textOn(preset.bg2) }}
                      onClick={() => applyPreset(preset)}
                    >
                      <span className="preset-dot" style={{ background: preset.accent }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </Section>
              <div className="custom-preview">
                <h3>Live preview</h3>
                <div className="preview-stack">
                  <div className="preview-bubble theirs">Hey — quick check-in</div>
                  <div className="preview-bubble mine">Looks good on my side.</div>
                </div>
              </div>
            </section>
          )}

          {tab === 'colors' && (
            <section className="custom-section">
              <Section title="Core palette">
                <div className="color-grid">
                  <ColorField label="Accent" value={settings.accent} fallback={readCss('--accent', '#e85d04')} onChange={(v) => patch({ accent: v })} />
                  <ColorField label="Accent 2" value={settings.accent2} fallback={readCss('--accent-2', '#0f766e')} onChange={(v) => patch({ accent2: v })} />
                  <ColorField label="Background" value={settings.bg} fallback={readCss('--bg', '#d7dde6')} onChange={(v) => patch({ bg: v })} />
                  <ColorField label="Panel" value={settings.bg2} fallback={readCss('--bg-2', '#f7f8fb')} onChange={(v) => patch({ bg2: v })} />
                  <ColorField label="Surface" value={settings.surface} fallback={readCss('--surface', '#eef1f6')} onChange={(v) => patch({ surface: v })} />
                  <ColorField label="Text" value={settings.text} fallback={readCss('--text', '#0c1118')} onChange={(v) => patch({ text: v })} />
                  <ColorField label="Muted" value={settings.muted} fallback={readCss('--muted', '#5b6778')} onChange={(v) => patch({ muted: v })} />
                  <ColorField label="Borders" value={settings.line} fallback={readCss('--line', '#c5ceda')} onChange={(v) => patch({ line: v })} />
                </div>
              </Section>
              <Section title="Bubbles & status">
                <div className="color-grid">
                  <ColorField label="Sent" value={settings.mine} fallback={readCss('--mine', '#e85d04')} onChange={(v) => patch({ mine: v })} />
                  <ColorField label="Received" value={settings.theirs} fallback={readCss('--theirs', '#ffffff')} onChange={(v) => patch({ theirs: v })} />
                  <ColorField label="Danger" value={settings.danger} fallback={readCss('--danger', '#dc2626')} onChange={(v) => patch({ danger: v })} />
                  <ColorField label="Success" value={settings.success} fallback={readCss('--success', '#16a34a')} onChange={(v) => patch({ success: v })} />
                </div>
              </Section>
            </section>
          )}

          {tab === 'chat' && (
            <section className="custom-section">
              <ChipRow label="Bubble shape" options={BUBBLE_STYLES} value={bubbleStyle} onChange={(id) => patch({ bubbleStyle: id })} />
              <ChipRow label="Density" options={DENSITIES} value={density} onChange={(id) => patch({ density: id })} />
              <Section title="Chat wallpaper">
                <div className="wallpaper-grid">
                  {WALLPAPERS.map((paper) => (
                    <button
                      key={paper.name}
                      type="button"
                      className={`wallpaper-tile ${wallpaper === paper.name ? 'active' : ''}`}
                      style={{
                        backgroundImage: paper.value === 'none' ? undefined : paper.value,
                        backgroundSize: paper.size,
                      }}
                      onClick={() => patch({ wallpaper: paper.name })}
                    >
                      {paper.name}
                    </button>
                  ))}
                </div>
              </Section>
              <ToggleRow label="Bubble shadows" hint="Depth under message bubbles" checked={settings.bubbleShadow !== false} onChange={(v) => patch({ bubbleShadow: v })} />
              <ToggleRow label="Timestamps" hint="Time under each message" checked={settings.showTimestamps !== false} onChange={(v) => patch({ showTimestamps: v })} />
              <ToggleRow label="Avatars in chat" hint="Show profile photos next to messages" checked={settings.showAvatars !== false} onChange={(v) => patch({ showAvatars: v })} />
              <ToggleRow label="Sender names" hint="Name above group message bubbles" checked={settings.showSenderNames !== false} onChange={(v) => patch({ showSenderNames: v })} />
              <ToggleRow label="Compact composer" hint="Tighter message input bar" checked={settings.compactComposer === true} onChange={(v) => patch({ compactComposer: v })} />
              <SliderField label="Bubble max width" value={settings.bubbleMaxWidth ?? 62} min={40} max={90} unit="%" onChange={(v) => patch({ bubbleMaxWidth: v })} />
            </section>
          )}

          {tab === 'chrome' && (
            <section className="custom-section">
              <ChipRow label="Button style" options={BUTTON_STYLES} value={buttonStyle} onChange={(id) => patch({ buttonStyle: id })} />
              <SliderField label="Corner radius" value={settings.radius ?? 18} min={0} max={28} onChange={(v) => patch({ radius: v })} />
              <SliderField label="Shell radius" value={settings.shellRadius ?? 28} min={0} max={40} hint="Outer app window corners" onChange={(v) => patch({ shellRadius: v })} />
              <SliderField label="Avatar shape" value={settings.avatarRadius ?? 22} min={0} max={24} hint="0 = square, 24 = circle" onChange={(v) => patch({ avatarRadius: v })} />
              <SliderField label="Avatar size" value={settings.avatarSize ?? 44} min={32} max={64} onChange={(v) => patch({ avatarSize: v })} />
              <SliderField label="Sidebar width" value={settings.sidebarWidth ?? 320} min={240} max={480} onChange={(v) => patch({ sidebarWidth: v })} />
              <SliderField label="Header height" value={settings.headerHeight ?? 72} min={52} max={96} onChange={(v) => patch({ headerHeight: v })} />
              <SliderField label="Composer height" value={settings.composerHeight ?? 64} min={48} max={96} onChange={(v) => patch({ composerHeight: v })} />
            </section>
          )}

          {tab === 'type' && (
            <section className="custom-section">
              <label className="slider-field">
                <span>Font family</span>
                <select
                  className="select-input"
                  value={settings.font || FONTS[0].value}
                  onChange={(e) => patch({ font: e.target.value })}
                >
                  {FONTS.map((font) => (
                    <option key={font.name} value={font.value} style={{ fontFamily: font.value }}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </label>
              <SliderField label="Font size" value={settings.fontSize ?? 15} min={12} max={20} onChange={(v) => patch({ fontSize: v })} />
              <SliderField label="Letter spacing" value={settings.letterSpacing ?? -0.02} min={-0.06} max={0.08} step={0.005} unit="em" onChange={(v) => patch({ letterSpacing: v })} />
              <SliderField label="Line height" value={settings.lineHeight ?? 1.45} min={1.15} max={1.9} step={0.05} unit="" onChange={(v) => patch({ lineHeight: v })} />
              <div className="custom-preview" style={{ fontFamily: settings.font || FONTS[0].value, fontSize: settings.fontSize ?? 15 }}>
                <h3>Typography preview</h3>
                <p style={{ margin: 0, color: 'var(--text)', letterSpacing: 'var(--tracking)', lineHeight: 'var(--lh)' }}>
                  Quiet chats. Fast replies. Yours across phone and PC.
                </p>
                <div className="preview-stack">
                  <div className="preview-bubble theirs">Can you send the link?</div>
                  <div className="preview-bubble mine">On it — one sec.</div>
                </div>
              </div>
            </section>
          )}

          {tab === 'brand' && (
            <section className="custom-section">
              <label className="slider-field">
                <span>App name</span>
                <input
                  type="text"
                  value={brand}
                  maxLength={24}
                  onChange={(e) => patch({ brandName: e.target.value })}
                  placeholder="IMX"
                />
              </label>
              <Section title="Logo">
                <div className="logo-row">
                  <div
                    className="logo-preview"
                    style={settings.logoUrl ? { backgroundImage: `url(${settings.logoUrl})`, backgroundSize: 'cover' } : undefined}
                  >
                    {!settings.logoUrl ? <span>{brand[0]?.toUpperCase() || 'I'}</span> : null}
                  </div>
                  <div className="logo-actions">
                    <button className="btn" type="button" onClick={() => logoRef.current?.click()}>
                      Upload logo
                    </button>
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogo} />
                    {settings.logoUrl ? (
                      <button className="btn danger" type="button" onClick={() => patch({ logoUrl: undefined })}>
                        Remove
                      </button>
                    ) : null}
                    <p className="hint">PNG or WebP, max 2MB</p>
                  </div>
                </div>
              </Section>
              <Section title="Quick marks">
                <div className="emoji-logo-grid">
                  {['💬', '⚡', '🔥', '🚀', '💎', '🌙', '☀️', '🎯', '🛡️', '🎧', '📦', '✨', '🛰️', '🧿'].map((emoji) => (
                    <button key={emoji} type="button" className="emoji-logo-btn" onClick={() => makeEmojiLogo(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </Section>
            </section>
          )}

          {tab === 'more' && (
            <section className="custom-section">
              <ToggleRow label="Reduce motion" hint="Turns down animations across the app" checked={settings.reduceMotion === true} onChange={(v) => patch({ reduceMotion: v })} />
              <ToggleRow label="Message enter animation" hint="Soft fade when messages appear" checked={settings.messageAnim !== false} onChange={(v) => patch({ messageAnim: v })} />
              <div className="custom-preview">
                <h3>Export</h3>
                <p className="hint">Copy your look to paste on another device.</p>
                <button className="btn" type="button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(settings, null, 2))}>
                  Copy settings JSON
                </button>
              </div>
              <div className="custom-preview">
                <h3>Import</h3>
                <textarea rows={4} placeholder="Paste settings JSON…" value={importDraft} onChange={(e) => setImportDraft(e.target.value)} />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    try {
                      commit(JSON.parse(importDraft) as CustomSettings);
                      setImportDraft('');
                      setError(null);
                    } catch {
                      setError('Invalid settings JSON.');
                    }
                  }}
                >
                  Apply import
                </button>
              </div>
              <div className="danger-zone">
                <h3>Reset everything</h3>
                <p className="hint">Restore all customization to defaults.</p>
                {confirmReset ? (
                  <div className="confirm-bar">
                    <span>Reset all customization?</span>
                    <button className="btn danger" type="button" onClick={resetAll}>
                      Yes, reset
                    </button>
                    <button className="btn" type="button" onClick={() => setConfirmReset(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="btn danger" type="button" onClick={() => setConfirmReset(true)}>
                    Reset to default
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="custom-footer">
          <button className="btn" type="button" onClick={() => setConfirmReset(true)}>
            Reset
          </button>
          <button className="btn primary" type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
