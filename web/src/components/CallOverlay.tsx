import React, { useEffect, useRef, useState } from 'react';
import type { CallState, CallInfo } from '../lib/useWebRTC';
import { useMediaSrc } from '../lib/media';
import { initials } from '../lib/messages';

function MiniAvatar({ user, size }: { user: { displayName: string; username?: string; avatarUrl?: string | null }; size?: number }) {
  const src = useMediaSrc(user.avatarUrl);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  const s = size || 80;
  return (
    <span className="call-avatar" style={{ width: s, height: s, fontSize: s * 0.35 }}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : initials(user.displayName || user.username || '')}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
}

export function CallOverlay({
  callState, callInfo, localStream, remoteStream, muted, videoOff,
  callError, callDuration, onAccept, onReject, onEnd,
  onToggleMute, onToggleVideo, onToggleScreenShare, screenSharing,
}: CallOverlayProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  if (callState === 'idle' || !callInfo) return null;

  const isVideo = callInfo.mode === 'video';
  const isIncoming = callState === 'ringing';
  const isOutgoing = callState === 'outgoing';

  const MicIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );

  const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.12 1.49-.34 2.17" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );

  const CamIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );

  const CamOffIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

  const PhoneIcon = () => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );

  const PhoneOffIcon = () => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" />
      <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2.5" />
    </svg>
  );

  if (isIncoming) {
    return (
      <div className="call-overlay incoming">
        <div className="call-incoming-card">
          <MiniAvatar user={{ displayName: callInfo.peerName, avatarUrl: callInfo.peerAvatar }} size={96} />
          <h2>{callInfo.peerName}</h2>
          <p>{isVideo ? 'Incoming video call' : 'Incoming voice call'}</p>
          {callError && <p className="call-error-text">{callError}</p>}
          <div className="call-incoming-actions">
            <button className="call-action call-accept" onClick={onAccept} aria-label="Accept"><PhoneIcon /></button>
            <button className="call-action call-reject" onClick={onReject} aria-label="Reject"><PhoneOffIcon /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-overlay active">
      {(isVideo || screenSharing) && (
        <div className="call-video-container">
          <video ref={remoteVideoRef} autoPlay playsInline className="call-remote-video" />
          <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
          <div className="call-video-header">
            <span className="call-video-name">{callInfo.peerName}</span>
            <span className="call-video-status">{callError || formatDuration(callDuration)}</span>
          </div>
        </div>
      )}
      {!isVideo && !screenSharing && (
        <div className="call-voice-container">
          <MiniAvatar user={{ displayName: callInfo.peerName, avatarUrl: callInfo.peerAvatar }} size={120} />
          <h2>{callInfo.peerName}</h2>
          <p className="call-status">
            {isOutgoing && !callError ? 'Calling...' : callError || `Connected ${formatDuration(callDuration)}`}
          </p>
        </div>
      )}
      <div className="call-controls">
        <button className={`call-ctrl ${muted ? 'active' : ''}`} onClick={onToggleMute} aria-label="Mute">
          {muted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <button className={`call-ctrl ${videoOff ? 'active' : ''}`} onClick={onToggleVideo} aria-label="Camera">
          {videoOff ? <CamOffIcon /> : <CamIcon />}
        </button>
        {onToggleScreenShare && (
          <button className={`call-ctrl ${screenSharing ? 'active' : ''}`} onClick={onToggleScreenShare} aria-label="Screen">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
        )}
        <button className="call-action call-end" onClick={onEnd} aria-label="End"><PhoneOffIcon /></button>
      </div>
    </div>
  );
}
