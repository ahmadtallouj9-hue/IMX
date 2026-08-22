import React, { useEffect, useRef, useState } from 'react';
import type { CallState, CallInfo } from '../lib/useWebRTC';
import { useMediaSrc } from '../lib/media';
import { initials } from '../lib/messages';

function MiniAvatar({ user, size }: { user: { displayName: string; username?: string; avatarUrl?: string | null }; size?: 'md' | 'lg' | 'xl' }) {
  const src = useMediaSrc(user.avatarUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  return (
    <span className={`call-avatar ${size ?? 'md'}`}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : initials(user.displayName || user.username || '')}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.12 1.49-.34 2.17" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CamOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" />
      <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5" />
    </svg>
  );
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface CallOverlayProps {
  callState: CallState;
  callInfo: CallInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  videoOff: boolean;
  callError: string | null;
  callDuration: number;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: () => void;
  screenSharing?: boolean;
  remoteScreenSharing?: boolean;
  canScreenShare?: boolean;
}

export function CallOverlay({
  callState, callInfo, localStream, remoteStream, muted, videoOff,
  callError, callDuration, onAccept, onReject, onEnd,
  onToggleMute, onToggleVideo, onToggleScreenShare, screenSharing,
  remoteScreenSharing, canScreenShare,
}: CallOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerAvatarSrc = useMediaSrc(callInfo?.peerAvatar);

  const isVideo = callInfo?.mode === 'video';
  const localVideoTrack = Boolean(localStream?.getVideoTracks().some((t) => t.readyState !== 'ended'));
  const showLocalPip = Boolean(
    (isVideo && !videoOff && localVideoTrack) || (screenSharing && localVideoTrack),
  );
  const showVideoSurface = Boolean(isVideo || screenSharing || remoteScreenSharing);

  useEffect(() => {
    const el = remoteAudioRef.current;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
      el.volume = 1;
      const playPromise = el.play();
      if (playPromise) playPromise.catch(() => {});
    }
  }, [remoteStream, callState]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
      const playPromise = el.play();
      if (playPromise) playPromise.catch(() => {});
    }
  }, [remoteStream, callState, isVideo, screenSharing, remoteScreenSharing]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream) {
      el.srcObject = localStream;
    }
  }, [localStream, showLocalPip]);

  useEffect(() => {
    if (callState === 'idle' || !callInfo) return;
    const root = overlayRef.current;
    const prev = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      );
    focusable()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (callState === 'ringing') onReject();
        else onEnd();
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
  }, [callState, callInfo, onReject, onEnd]);

  if (callState === 'idle' || !callInfo) return null;

  const isIncoming = callState === 'ringing';
  const isOutgoing = callState === 'outgoing';

  if (isIncoming) {
    return (
      <div className="call-overlay incoming" ref={overlayRef} role="dialog" aria-modal="true" aria-label="Incoming call">
        <div className="call-incoming-card" role="alert">
          <MiniAvatar user={{ displayName: callInfo.peerName, avatarUrl: callInfo.peerAvatar }} size="lg" />
          <h2>{callInfo.peerName}</h2>
          <p>{isVideo ? 'Incoming video call' : 'Incoming voice call'}</p>
          {callError && <p className="call-error-text" role="alert">{callError}</p>}
          <div className="call-incoming-actions">
            <button className="call-action call-accept" onClick={onAccept} aria-label="Accept call"><PhoneIcon /></button>
            <button className="call-action call-reject" onClick={onReject} aria-label="Reject call"><PhoneOffIcon /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-overlay active" ref={overlayRef} role="dialog" aria-modal="true" aria-label={isVideo ? 'Video call' : 'Voice call'}>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {showVideoSurface && (
        <div className="call-video-container">
          {peerAvatarSrc && (
            <img src={peerAvatarSrc} alt="" className="call-peer-bg" />
          )}
          <video ref={remoteVideoRef} autoPlay playsInline muted className="call-remote-video" />
          {showLocalPip && (
            <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
          )}
          {screenSharing && !isVideo && (
            <div className="call-screenshare-overlay">
              <MiniAvatar user={{ displayName: callInfo.peerName, avatarUrl: callInfo.peerAvatar }} size="lg" />
              <span className="call-video-name">{callInfo.peerName}</span>
              <span className="call-video-status">{callError || `Sharing screen · ${formatDuration(callDuration)}`}</span>
            </div>
          )}
          {remoteScreenSharing && !screenSharing && !isVideo && (
            <div className="call-screenshare-overlay">
              <span className="call-video-name">{callInfo.peerName}</span>
              <span className="call-video-status">{callError || `Viewing screen · ${formatDuration(callDuration)}`}</span>
            </div>
          )}
          {(isVideo || remoteScreenSharing || screenSharing) && (
            <div className="call-video-header">
              <span className="call-video-name">{callInfo.peerName}</span>
              <span className="call-video-status">{callError || formatDuration(callDuration)}</span>
            </div>
          )}
        </div>
      )}
      {!showVideoSurface && (
        <div className="call-voice-container">
          <MiniAvatar user={{ displayName: callInfo.peerName, avatarUrl: callInfo.peerAvatar }} size="xl" />
          <h2>{callInfo.peerName}</h2>
          <p className={`call-status ${callError ? 'call-error-text' : ''}`} role={callError ? 'alert' : undefined}>
            {isOutgoing && !callError ? 'Calling...' : callError || `Connected ${formatDuration(callDuration)}`}
          </p>
        </div>
      )}
      <div className="call-controls">
        <button
          className={`call-ctrl ${muted ? 'active' : ''}`}
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
          aria-pressed={muted}
        >
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>
        {isVideo && (
          <button
            className={`call-ctrl ${videoOff ? 'active' : ''}`}
            onClick={onToggleVideo}
            aria-label={videoOff ? 'Camera off' : 'Camera on'}
            aria-pressed={!videoOff}
          >
            {videoOff ? <CamOffIcon /> : <CamIcon />}
          </button>
        )}
        {canScreenShare && onToggleScreenShare && (
          <button
            className={`call-ctrl ${screenSharing ? 'active' : ''}`}
            onClick={onToggleScreenShare}
            aria-label={screenSharing ? 'Stop sharing screen' : 'Share screen'}
            aria-pressed={Boolean(screenSharing)}
          >
            <ScreenIcon />
          </button>
        )}
        <button className="call-action call-end" onClick={onEnd} aria-label="End call"><PhoneOffIcon /></button>
      </div>
    </div>
  );
}
