import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket, getSocket } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

export type CallState = 'idle' | 'ringing' | 'outgoing' | 'active';
export type CallMode = 'voice' | 'video';

export interface CallInfo {
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  mode: CallMode;
}

export function useWebRTC(me: { id: string; displayName: string; avatarUrl?: string | null }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const bufferedIceRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setVideoOff(false);
    setScreenSharing(false);
    setCallError(null);
    bufferedIceRef.current = [];
  }, []);

  const createPeer = useCallback((conversationId: string, targetUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        setRemoteStream(e.streams[0]);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const socket = getSocket();
        if (socket) {
          socket.emit('call:ice', { conversationId, targetUserId, candidate: e.candidate.toJSON() });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        setCallError('Connection failed');
        setTimeout(() => { cleanup(); }, 2000);
      } else if (pc.connectionState === 'disconnected') {
        setCallError('Peer disconnected');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallState('active');
        setCallError(null);
      } else if (pc.iceConnectionState === 'failed') {
        setCallError('Could not connect — try again');
      }
    };

    return pc;
  }, [cleanup]);

  const flushIce = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of bufferedIceRef.current) {
      pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
    }
    bufferedIceRef.current = [];
  }, []);

  const getMedia = useCallback(async (mode: CallMode) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mode === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.error('[WebRTC] getUserMedia failed:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied — allow it in browser settings'
        : err?.name === 'NotFoundError'
          ? 'No microphone found'
          : `Media error: ${err?.message ?? err}`;
      setCallError(msg);
      throw new Error(msg);
    }
  }, []);

  const startCall = useCallback(async (conversationId: string, peerId: string, peerName: string, peerAvatar?: string | null, mode: CallMode = 'voice') => {
    try {
      setCallError(null);
      const stream = await getMedia(mode);
      const pc = createPeer(conversationId, peerId);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      console.log('[WebRTC] Added tracks:', stream.getTracks().map((t) => t.kind));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Created offer, local description set');

      setCallState('outgoing');
      setCallInfo({ conversationId, peerId, peerName, peerAvatar, mode });

      connectSocket().emit('call:init', { conversationId, calleeId: peerId, offer });
      console.log('[WebRTC] Sent call:init to', peerId);
    } catch (err: any) {
      console.error('[WebRTC] startCall failed:', err);
      setCallError(err.message ?? 'Failed to start call');
      cleanup();
    }
  }, [getMedia, createPeer, cleanup]);

  const acceptCall = useCallback(async (conversationId: string, peerId: string, peerName: string, peerAvatar: string | null | undefined, offer: RTCSessionDescriptionInit, mode: CallMode = 'voice') => {
    try {
      setCallError(null);
      console.log('[WebRTC] Accepting call from', peerId);
      const stream = await getMedia(mode);
      const pc = createPeer(conversationId, peerId);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      console.log('[WebRTC] Added tracks:', stream.getTracks().map((t) => t.kind));

      console.log('[WebRTC] Setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC] Remote description set, flushing ICE...');

      flushIce();

      console.log('[WebRTC] Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[WebRTC] Answer created and local description set');

      setCallState('active');
      setCallInfo({ conversationId, peerId, peerName, peerAvatar, mode });

      connectSocket().emit('call:accept', { conversationId, answer });
      console.log('[WebRTC] Sent call:accept');
    } catch (err: any) {
      console.error('[WebRTC] acceptCall failed:', err);
      setCallError(err.message ?? 'Failed to accept call');
      cleanup();
    }
  }, [getMedia, createPeer, flushIce, cleanup]);

  const rejectCall = useCallback((conversationId: string) => {
    getSocket()?.emit('call:reject', { conversationId });
    setCallState('idle');
    setCallInfo(null);
    cleanup();
  }, [cleanup]);

  const endCall = useCallback((conversationId: string) => {
    getSocket()?.emit('call:end', { conversationId });
    setCallState('idle');
    setCallInfo(null);
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const track = s.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const s = localStreamRef.current;
    if (!s) return;
    const track = s.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoOff(!track.enabled);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const ls = localStreamRef.current;
    if (!pc || !ls) return;

    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = ls.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      await sender?.replaceTrack(camTrack ?? null);
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        await sender?.replaceTrack(screenTrack);
        setScreenSharing(true);
        screenTrack.onended = () => void toggleScreenShare();
      } catch {
        setScreenSharing(false);
      }
    }
  }, [screenSharing]);

  useEffect(() => {
    const socket = connectSocket();

    const onRinging = (data: { conversationId: string; caller: { id: string; displayName: string; avatarUrl?: string | null }; offer: unknown }) => {
      console.log('[WebRTC] Received call:ringing from', data.caller.id);
      bufferedIceRef.current = [];
      setCallState('ringing');
      setCallInfo({
        conversationId: data.conversationId,
        peerId: data.caller.id,
        peerName: data.caller.displayName,
        peerAvatar: data.caller.avatarUrl,
        mode: 'voice',
      });
      (window as any).__pendingCallOffer = data.offer;
      (window as any).__pendingCallPeerId = data.caller.id;
      (window as any).__pendingCallConvId = data.conversationId;
    };

    const onAccepted = (data: { conversationId: string; answer: unknown }) => {
      console.log('[WebRTC] Received call:accepted');
      if (pcRef.current) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit))
          .then(() => { flushIce(); console.log('[WebRTC] Remote description (answer) set'); })
          .catch((err) => console.error('[WebRTC] Failed to set answer:', err));
      }
      setCallState('active');
    };

    const onRejected = () => { console.log('[WebRTC] Call rejected'); setCallState('idle'); setCallInfo(null); cleanup(); };
    const onEnded = () => { console.log('[WebRTC] Call ended'); setCallState('idle'); setCallInfo(null); cleanup(); };
    const onBusy = () => { setCallState('idle'); setCallInfo(null); setCallError('User is busy'); cleanup(); };
    const onOffline = () => { setCallState('idle'); setCallInfo(null); setCallError('User is offline'); cleanup(); };

    const onCallIce = (data: { candidate: unknown }) => {
      if (data.candidate) {
        if (pcRef.current) {
          pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit)).catch(console.error);
        } else {
          bufferedIceRef.current.push(data.candidate as RTCIceCandidateInit);
        }
      }
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ice', onCallIce);
    socket.on('call:busy', onBusy);
    socket.on('call:offline', onOffline);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ice', onCallIce);
      socket.off('call:busy', onBusy);
      socket.off('call:offline', onOffline);
      socket.off('call:ended', onEnded);
    };
  }, [cleanup, flushIce]);

  return {
    callState, callInfo, localStream, remoteStream, muted, videoOff, screenSharing, callError,
    startCall, acceptCall, rejectCall, endCall,
    toggleMute, toggleVideo, toggleScreenShare,
  };
}
