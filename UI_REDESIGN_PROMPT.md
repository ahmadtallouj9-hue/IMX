# IMX Chat App — Complete UI Redesign Prompt

> **Goal**: Completely redesign and fix 100% of the frontend UI for IMX, a real-time chat application. Every pixel, every interaction, every responsive breakpoint. You are rebuilding the visual layer from scratch while preserving all existing functionality.

---

## Project Overview

IMX is a WhatsApp/Discord-inspired real-time chat app with:
- Authentication (login/register)
- 1-on-1 and group messaging (text, images, video, audio, files, voice messages)
- WebRTC audio/video calls and screen sharing
- Message reactions (emoji)
- Customization panel (themes, colors, fonts, layout, logos)
- Notifications system
- Real-time typing indicators, read receipts, online status

**Stack**: React 18 + TypeScript, Vite, plain CSS (no framework), Socket.IO, Capacitor (Android). No Tailwind, no CSS-in-JS, no component library. All styling is in a single `styles.css`.

**Live URL**: https://imx-cbf0.onbelmo.uk (both web and Electron/Android load from here)

---

## File Structure

```
web/src/
  styles.css                          # ALL styles (568 lines, hand-written)
  App.tsx                             # Router
  main.tsx                            # Entry
  pages/
    Auth.tsx                          # Login/Register form
    Messenger.tsx                     # Main chat page (~800 lines, the core)
    ChatDetails.tsx                   # Chat info/settings
    FriendsPanel.tsx                  # Friends list
    ServerSetup.tsx                   # First-time setup
  components/
    CallOverlay.tsx                   # WebRTC call UI (voice + video)
    CustomizationPanel.tsx            # Settings/theme panel
  lib/
    api.ts                            # API client (fetch wrappers)
    auth.tsx                          # Auth context
    compress.ts                       # Image compression
    emojis.ts                         # Emoji data
    install.ts                        # PWA install
    media.ts                          # useMediaSrc hook
    messages.ts                       # Message helpers
    socket.ts                         # Socket.IO client
    types.ts                          # TypeScript types
    useWebRTC.ts                      # WebRTC hook (call logic)
```

---

## Design Direction

**Target feel**: A polished, modern dark chat app. Think Discord meets Telegram meets iMessage. Not flat, not skeuomorphic — clean surfaces with subtle depth.

### Color Palette (Dark Mode — default)
```
Background:       #0f1117  (main bg, deepest)
Surface 1:        #1a1d27  (sidebar, cards)
Surface 2:        #232734  (hover states, active items)
Surface 3:        #2c3040  (input fields, elevated surfaces)
Border:           #2e3347  (subtle dividers)
Border strong:    #3d4259  (focused inputs, active states)

Accent primary:   #6366f1  (indigo-500 — buttons, links, active states)
Accent hover:     #818cf8  (indigo-400 — hover)
Accent soft:      rgba(99, 102, 241, 0.12)  (backgrounds)
Accent ring:      rgba(99, 102, 241, 0.25)  (focus rings)

Text primary:     #e4e6eb
Text secondary:   #8b8fa3
Text muted:       #5c5f73

Success:          #22c55e
Warning:          #f59e0b
Danger:           #ef4444
Danger soft:      rgba(239, 68, 68, 0.12)
```

### Light Mode
```
Background:       #f8f9fc
Surface 1:        #ffffff
Surface 2:        #f0f1f5
Surface 3:        #e8e9ef
Border:           #d1d5de
Text primary:     #1a1d27
Text secondary:   #5c5f73
Text muted:       #8b8fa3
Accent:           #6366f1 (same)
```

### Typography
- Font: `'Inter', system-ui, -apple-system, sans-serif` (loaded via Google Fonts link in index.html, NOT @import in CSS)
- Base size: 14px
- Line height: 1.5
- Letter spacing: -0.01em (tight tracking on headings)

### Spacing Scale
Use a consistent 4px grid: `4, 8, 12, 16, 20, 24, 32, 48`

### Border Radius
```
--r-xs: 4px      (small chips, tags)
--r-sm: 8px      (buttons, inputs)
--r-md: 12px     (cards, message bubbles)
--r-lg: 16px     (modals, panels)
--r-xl: 20px     (sheets, overlays)
--r-full: 9999px (pills, avatars)
```

### Shadows (dark mode)
```
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.35)
--shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.45)
```

### Animations
- Duration fast: 120ms
- Duration normal: 200ms
- Duration slow: 300ms
- Easing: cubic-bezier(0.16, 1, 0.3, 1) (ease-out-expo feel)
- All interactive elements: background, color, transform, box-shadow transitions
- Micro-interactions: scale on press (0.97), slide-in for panels

---

## Critical Bugs to Fix

### CallOverlay.tsx
1. **Rules of Hooks violation** (line ~149): `useMediaSrc(callInfo.peerAvatar)` is called AFTER conditional returns. Move it above all early returns, or remove it entirely (MiniAvatar resolves it internally).
2. **Double audio echo**: The hidden `<audio>` element AND the remote `<video>` both play remote audio. Add `muted` to the remote `<video>` element.
3. **Empty black PiP**: Local video renders when camera is off. Conditionally render only when `isVideo && !videoOff && localVideoTrack`.
4. **Screen share in voice**: Shows black void. When `screenSharing && !isVideo`, show screen share video with peer avatar overlaid, not empty video.
5. **Icons re-created every render**: Move the 6 SVG icon components (MicIcon, CamIcon, ScreenIcon, PhoneIcon, MicOffIcon, CamOffIcon) OUTSIDE the CallOverlay component to module scope. Currently they're inside the component, so every timer tick re-renders them, breaking transitions.
6. **No accessibility**: Add `role="dialog"`, `aria-modal="true"`, Escape key handler, focus trap, `role="alert"` on incoming call, state-aware aria-labels ("Mute"/"Unmute"), `aria-pressed` on toggle buttons, `aria-hidden="true"` on SVGs.

### Auth.tsx
7. **minLength={8} on login**: Remove this constraint from the login form — it blocks sign-in for accounts created with shorter passwords. Only keep it on register.
8. **No password show/hide**: Add an eye icon toggle to show/hide password.
9. **No autoFocus**: Add `autoFocus` to the first input field.
10. **Install button in wrong tab order**: The Install button appears before the submit button visually. Move it after the form or make it visually secondary.

### CustomizationPanel.tsx
11. **Preset application bug**: `applyPreset` calls `update()` 3 times with stale state. Fix: merge all preset values into a single `update()` call.
12. **Logo upload wiped**: Line ~131 sets `style.background = 'none'` AFTER setting `backgroundImage`. Remove the `background = 'none'` line.
13. **Slider 0-value bug**: `settings.x || default` treats 0 as falsy. Use `settings.x ?? default` instead (nullish coalescing) for all slider values.
14. **Light mode broken after customization**: All `setProperty` calls write inline root styles that beat `html.light` CSS rules. Fix: When toggling light mode, clear all inline custom properties so CSS variables take over. Add a `clearCustomProperties()` function.
15. **Light mode presets never shown**: `LIGHT_PRESET_COLORS` is defined but never used. Show appropriate presets based on current theme mode.
16. **Preset text unreadable**: Hardcoded `#e8eaed` text on preset tiles. Use dynamic color based on background luminance.
17. **No focus trap / Escape**: Overlay closes on backdrop click but has no keyboard handling.
18. **Font options not loaded**: Roboto, Poppins, JetBrains Mono are offered but never imported. Either load them via Google Fonts link in index.html or remove them from the options.
19. **--font-size token unused**: The fontSize slider writes `--font-size` but nothing in CSS uses it. Either wire it up in CSS or remove the slider.
20. **Danger zone border hardcoded**: Use `var(--danger)` instead of `rgba(237,66,69,0.2)`.

### styles.css
21. **Mobile page capped at 360px**: `:root { max-width: 360px }` in the 480px media query caps the ENTIRE page. Remove this.
22. **Z-index chaos**: No z-index tokens. Add a scale: `--z-sidebar: 100`, `--z-dropdown: 200`, `--z-overlay: 300`, `--z-modal: 400`, `--z-toast: 500`, `--z-call: 1000`. Apply consistently across all positioned elements.
23. **Message actions clipped**: `.msg-actions { top: -16px }` gets clipped by `.messages { overflow: auto }` on the first message. Position actions inside the bubble or add padding-top to the messages container for the first bundle.
24. **Conversation name overflow**: `.row strong` needs `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.
25. **Reduced motion broken**: The `prefers-reduced-motion` block zeroes durations but leaves `animation-iteration-count: infinite` running (typing dots, pulse-rec). Set `animation-iteration-count: 1` too.
26. **Dead CSS rules**: Remove duplicate html.light rules that are identical to base rules. Remove duplicate theme definitions.
27. **Search icon hardcoded stroke**: SVG stroke is dark-theme only. Use currentColor or a CSS variable.
28. **Quote hover contrast collapse in light mode**: Add `html.light .quote:hover { background: rgba(0,0,0,0.08) }`.
29. **Audio play button no hover state**: Add `:hover` to `.wa-audio-play`.
30. **React-btn touch target too small**: The `.react-btn span` is ~14px. Minimum 24px touch target.
31. **Google Fonts blocking render**: Move `@import` to `<link rel="preconnect">` + `<link href>` in index.html.
32. **Lightbox/overlay/call backgrounds hardcoded**: Use CSS variables for these.
33. **Stamp/meta contrast too low**: Bump font size and contrast for `.stamp` and `.meta`.
34. **Scrollbar thumb nearly invisible**: Lighten the scrollbar thumb color.
35. **Welcome screen literal duration**: Use `--dur-slow` instead of `0.4s`.
36. **Theme transition on ALL elements is expensive**: Limit transition to only the key surfaces.

---

## Complete Redesign Instructions

### 1. styles.css — REWRITE ENTIRELY

Delete the entire file and rebuild from scratch using the design tokens above. Key sections:

**A) Design Tokens**: All CSS custom properties as defined in the Design Direction section above. Include BOTH dark and light mode tokens. Add z-index scale tokens. Add spacing tokens.

**B) Base Reset**: Minimal, modern reset. Box-sizing border-box. Remove default margins. Set body background, color, font. Antialiased text rendering.

**C) Typography**: Heading sizes (h1-h6), body text, small text, muted text. All using the token system.

**D) Scrollbar**: Custom thin scrollbar for both dark and light modes. Use `scrollbar-color` for Firefox and `::-webkit-scrollbar` for Chrome/Safari.

**E) Auth Page**: 
- Full-page split layout on desktop (hero left, form right)
- Centered single column on mobile
- Clean card with subtle border and shadow
- Input fields with proper focus states and labels
- Toggle between login/register

**F) Buttons**:
- Base `.btn` with padding, border-radius, transitions, shadow
- `.btn.primary` accent background
- `.btn.danger` red outline
- `.icon-btn` square, icon-centered
- All buttons: hover, active (scale 0.97), disabled, focus-visible states

**G) Shell / Sidebar**:
- CSS Grid: `grid-template-columns: var(--sidebar-w) 1fr`
- Sidebar: flex column, Surface 1 background, right border
- Sidebar header: flex row, brand + actions, height matching --header-h
- Search input: icon left, rounded, Surface 3 bg
- Conversation list: scrollable flex column
- Conversation rows: flex row, hover = Surface 2, active = accent-soft + left accent bar
- Row elements: avatar, name (ellipsis), preview (ellipsis), meta (time + badge)
- Unread badge: accent-2 pill with shadow
- Online indicator: 12px green dot, bottom-right of avatar, 2px border matching sidebar bg

**H) Chat Area**:
- Main container: flex column, full height, no overflow on container
- Chat header: flex row, peer info, action buttons, Surface 1 background
- Messages area: flex column, gap, scrollable, padding 16px 48px (12px on mobile)
- Message bundles: max-width 65%, my messages align right (flex-direction row-reverse)
- Message bubbles: Surface 2 bg for theirs, accent bg for mine, white text for mine
- Bubble padding: 8px 12px, border-radius 12px
- Bubble with image/video: no padding, full bleed media
- Day separators: centered pill with date text, sticky at top

**I) Composer**:
- Fixed bottom, Surface 1 background, border-top
- Input: rounded, Surface 3 bg, flex: 1
- Action buttons: icon buttons (attach, emoji, mic, send)
- Send button: accent bg, pill shape, only visible when there's text
- Voice recording: pulsing red indicator
- Emoji picker: grid below composer, animated slide-in

**J) Message Actions (hover)**:
- Absolute positioned above bubble
- Appears on hover/touch with fade-in transition
- Icon buttons: reply, react, more
- Touch: static position below bubble, always visible
- First message in chat: ensure not clipped (use padding or overflow visible on messages container)

**K) Reactions**:
- Small chips below message bubble
- Emoji + count, pill shape
- Own reaction: accent-soft background
- Add reaction button: dashed circle, appears on hover

**L) Call UI**:
- Full-screen overlay with z-index from tokens
- Incoming: centered card with caller info, pulsing avatar, accept/reject buttons
- Active voice: centered peer info with duration, controls at bottom
- Active video: full-screen remote video, small local PiP (bottom-right, 140px)
- Controls: circular buttons with backdrop blur, glass-morphism feel
- Transitions: smooth fade-in for overlay, slide-up for controls

**M) Sheets / Overlays**:
- Backdrop: dark overlay with blur
- Sheet: centered, Surface 1 bg, border-radius XL, max-width 480px, animated slide-in
- Close on backdrop click AND Escape key

**N) Notifications**:
- Slide-in panel from right, full height, Surface 1 bg
- Notification items: flex row, icon + content + time
- Unread indicator: left accent bar

**O) Welcome Screen**:
- Centered column, large logo (animated gradient), heading, subtext
- Two action buttons: primary (Find Friends) and secondary (Customize)
- Hint text below

**P) Lightbox**:
- Full-screen dark overlay with blur
- Image centered, max 90vw/90vh
- Close button top-right, hint text bottom-center
- Drag to pan, scroll to zoom

**Q) Responsive Breakpoints**:
- Desktop: > 1024px — full sidebar + chat
- Tablet: 768px-1024px — narrower sidebar
- Mobile: < 768px — sidebar OR chat (never both), hamburger menu, back button
- Small: < 480px — hide search/video buttons in composer, tighter spacing
- NEVER cap the page width with max-width on :root

**R) Accessibility**:
- All focus-visible outlines using accent color
- Reduced motion: disable all animations AND set iteration-count to 1
- Minimum touch targets: 44px for buttons, 24px for inline actions
- Color contrast: minimum 4.5:1 for text, 3:1 for large text
- Screen reader only class: `.sr-only` for visually hidden but accessible content

**S) Animations**:
- `@keyframes msgIn`: fade + slide up 8px
- `@keyframes fadeSlideIn`: fade + slide up 6px
- `@keyframes sheetIn`: fade + slide up 12px + scale 0.96
- `@keyframes fadeUp`: fade + slide up 16px
- `@keyframes typingDot`: bounce dots
- `@keyframes pulseRec`: pulsing ring for recording
- `@keyframes fadeIn`: simple opacity fade
- `@keyframes avatarPulse`: ring expanding outward for active call

### 2. CallOverlay.tsx — REWRITE

Restructure the entire component:
- Move all 6 SVG icon components to MODULE SCOPE (outside the component function)
- Move `useMediaSrc` above all conditional returns
- Add `muted` attribute to remote `<video>` element
- Conditionally render local PiP video only when camera is active
- Fix screen share to show content with peer info overlay
- Add `role="dialog"`, `aria-modal="true"` to overlay
- Add Escape key handler (reject incoming / end active)
- Add state-aware aria-labels ("Mute"/"Unmute", "Camera on"/"Camera off")
- Add `aria-pressed` on toggle buttons
- Add `aria-hidden="true"` on SVGs
- Add `role="alert"` on incoming call card and error messages
- Use CSS classes from styles.css, remove all inline styles except dynamic ones (video src, z-index)
- Clean up the peer avatar sizing to use CSS classes instead of inline number props

### 3. Auth.tsx — REWRITE

- Remove `minLength={8}` from login form (keep on register only)
- Add password show/hide toggle (eye icon)
- Add `autoFocus` on username/email field
- Add proper label associations (id + htmlFor)
- Add `aria-describedby` linking error banner to inputs
- Add loading spinner in button during submit
- Move Install button below the form or make it visually tertiary
- Clean up the hero section typography
- Ensure the form card is properly centered on all screen sizes

### 4. CustomizationPanel.tsx — REWRITE

- Fix `applyPreset` to merge all values in a single `update()` call
- Fix logo upload: remove `style.background = 'none'` after backgroundImage
- Fix slider 0-value: use `??` (nullish coalescing) for all defaults
- Fix light mode: add `clearCustomProperties()` that removes all inline root styles when toggling modes
- Show appropriate presets for current theme mode (dark presets in dark mode, light presets in light mode)
- Dynamic preset tile text color based on background luminance
- Remove font options that aren't loaded (Roboto, Poppins, JetBrains Mono) OR load them in index.html
- Wire up `--font-size` token in CSS or remove the fontSize slider
- Use `var(--danger)` for danger zone border
- Add Escape key handler to close
- Add `role="tablist"` on tabs, `role="tab"` + `aria-selected` on each tab
- Add focus trap when panel is open
- Reduce inline styles — use CSS classes where possible
- Add `localStorage.setItem` try/catch for QuotaExceededError
- Add confirmation dialog before Reset
- Add file size/type validation on logo upload
- Use CSS classes for styling instead of pervasive inline styles

### 5. Messenger.tsx — POLISH

This file is the largest (~800 lines). Focus on:
- Ensure the sidebar toggle (hamburger) works correctly on all screen sizes
- Ensure welcome screen is shown when no conversation is selected
- Ensure the back button on mobile returns to sidebar
- Ensure conversation list has proper overflow and ellipsis on all text
- Ensure message hover actions are not clipped
- Ensure reactions display correctly in all message types
- Ensure the composer is properly positioned and doesn't overlap keyboard on mobile
- Add keyboard shortcuts: Escape to close sheets, Enter to send (with Shift+Enter for newline)
- Ensure all modals/sheets handle Escape key

### 6. index.html — UPDATE

- Add `<link rel="preconnect" href="https://fonts.googleapis.com">` 
- Add `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
- Add `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`
- Remove any CSS @import for fonts

---

## Rules

1. **DO NOT** change any business logic, API calls, socket events, or WebRTC connection handling. Only change UI/UX code.
2. **DO NOT** remove any existing functionality. Every feature that exists must still work.
3. **DO NOT** change prop interfaces or component signatures unless fixing a bug requires it (like moving hooks above returns).
4. **DO** preserve all event handlers (onClick, onChange, onSubmit, etc.) — they connect to business logic.
5. **DO** preserve all state variables and their setters — only change how they're rendered visually.
6. **DO** keep all existing class names OR update them consistently across both TSX and CSS files.
7. **DO** test that every interaction still works after changes: sending messages, uploading files, making calls, toggling themes, customizing settings.
8. **DO** ensure the build passes: run `npm run build` in the `web/` directory after all changes.
9. **DO** ensure both dark AND light mode work correctly.
10. **DO** ensure mobile responsiveness at 320px, 375px, 390px, 414px, 768px, 1024px, and 1440px widths.

---

## Build & Deploy

After all changes:
1. Run `npm run build` in `web/` directory
2. Run `node scripts/copy-web-dist.mjs` from project root
3. Commit and push to deploy to Belmo

The server auto-serves `server/web-dist/` as static files. No server rebuild needed for CSS/JS changes.