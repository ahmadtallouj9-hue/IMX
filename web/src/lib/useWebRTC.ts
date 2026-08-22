import { useCallback, useEffect, useRef, useState } from 'react';
import { isNativeApp } from './install';
import { connectSocket, getSocket } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // Public demo TURN — better than nothing for symmetric NATs; replace with owned coturn later
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 1,
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

function canScreenShare(): boolean {
  if (isNativeApp()) return false;
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export function useWebRTC(me: { id: string; displayName: string; avatarUrl?: string | null }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSharingRef = useRef(false);
  const callInfoRef = useRef<CallInfo | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const makingOfferRef = useRef(false);
  const politeRef = useRef(false);
  const bufferedIceRef = useRef<RTCIceCandidateInit[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callInfoRef.current = callInfo;
  }, [callInfo]);
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);
  useEffect(() => {
    screenSharingRef.current = screenSharing;
  }, [screenSharing]);

  const clearOutgoingTimer = useCallback(() => {
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
  }, []);

  const resetCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onnegotiationneeded = null;
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
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    clearOutgoingTimer();
    remoteStreamRef.current = null;
    makingOfferRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setVideoOff(false);
    setScreenSharing(false);
    setRemoteScreenSharing(false);
    setCallError(null);
    setCallDuration(0);
    bufferedIceRef.current = [];
  }, [clearOutgoingTimer]);

  const fullCleanup = useCallback(() => {
    resetCall();
    setCallState('idle');
    setCallInfo(null);
    callStateRef.current = 'idle';
    callInfoRef.current = null;
  }, [resetCall]);

  const endCallAndCleanup = useCallback((conversationId?: string) => {
    const id = conversationId ?? callInfoRef.current?.conversationId;
    if (id) getSocket()?.emit('call:end', { conversationId: id });
    fullCleanup();
  }, [fullCleanup]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc?.remoteDescription) return;
    const pending = bufferedIceRef.current.splice(0);
    for (const c of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.error('[WebRTC] addIceCandidate failed:', err);
      }
    }
  }, []);

  const createPeer = useCallback((conversationId: string, targetUserId: string, polite: boolean) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    politeRef.current = polite;

    pc.ontrack = (e) => {
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = new MediaStream();
        remoteStreamRef.current = stream;
      }
      for (const track of e.streams[0]?.getTracks() ?? [e.track]) {
        const exists = stream.getTracks().some((t) => t.id === track.id);
        if (!exists) stream.addTrack(track);
        track.onunmute = () => setRemoteStream(new MediaStream(stream!.getTracks()));
      }
      if (e.track.kind === 'video') setRemoteScreenSharing(true);
      setRemoteStream(new MediaStream(stream.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      getSocket()?.emit('call:ice', {
        conversationId,
        targetUserId,
        candidate: e.candidate.toJSON(),
      });
    };

    pc.onnegotiationneeded = () => {
      void (async () => {
        try {
          makingOfferRef.current = true;
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          getSocket()?.emit('call:renegotiate', {
            conversationId,
            targetUserId,
            description: pc.localDescription,
          });
        } catch (err) {
          console.error('[WebRTC] renegotiation failed:', err);
        } finally {
          makingOfferRef.current = false;
        }
      })();
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed') {
        setCallError('Connection failed — no route to peer');
        setTimeout(() => endCallAndCleanup(), 2500);
      } else if (state === 'disconnected') {
        setCallError('Connection unstable…');
        // Attempt ICE restart once
        void pc.restartIce?.();
      } else if (state === 'connected') {
        setCallError(null);
      } else if (state === 'closed') {
        fullCleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        setCallError('Could not establish connection — try again');
        setTimeout(() => endCallAndCleanup(), 2500);
      }
    };

    return pc;
  }, [endCallAndCleanup, fullCleanup]);

  const getMedia = useCallback(async (mode: CallMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = 'Media devices unavailable — open IMX over HTTPS';
      setCallError(msg);
      throw new Error(msg);
    }
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: mode === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      console.error('[WebRTC] getUserMedia failed:', err);
      const msg =
        e?.name === 'NotAllowedError'
          ? 'Microphone/camera permission denied'
          : e?.name === 'NotFoundError'
            ? 'No microphone/camera found'
            : `Media error: ${e?.message ?? String(err)}`;
      setCallError(msg);
      throw new Error(msg);
    }
  }, []);

  const startCall = useCallback(async (
    conversationId: string,
    peerId: string,
    peerName: string,
    peerAvatar?: string | null,
    mode: CallMode = 'voice',
  ) => {
    try {
      setCallError(null);
      const stream = await getMedia(mode);
      // Caller is impolite; callee is polite (perfect negotiation)
      const pc = createPeer(conversationId, peerId, false);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const info: CallInfo = { conversationId, peerId, peerName, peerAvatar, mode };
      setCallState('outgoing');
      setCallInfo(info);
      callStateRef.current = 'outgoing';
      callInfoRef.current = info;

      connectSocket().emit('call:init', { conversationId, calleeId: peerId, offer, mode });

      clearOutgoingTimer();
      outgoingTimerRef.current = setTimeout(() => {
        if (callStateRef.current === 'outgoing') {
          setCallError('No answer — call ended');
          endCallAndCleanup(conversationId);
        }
      }, 45000);
    } catch (err: unknown) {
      console.error('[WebRTC] startCall failed:', err);
      setCallError(err instanceof Error ? err.message : 'Failed to start call');
      endCallAndCleanup(conversationId);
    }
  }, [getMedia, createPeer, clearOutgoingTimer, endCallAndCleanup]);

  const acceptCall = useCallback(async (
    conversationId: string,
    peerId: string,
    peerName: string,
    peerAvatar: string | null | undefined,
    offer: RTCSessionDescriptionInit,
    mode: CallMode = 'voice',
  ) => {
    try {
      setCallError(null);
      const stream = await getMedia(mode);
      const pc = createPeer(conversationId, peerId, true);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIce();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const info: CallInfo = { conversationId, peerId, peerName, peerAvatar, mode };
      setCallInfo(info);
      setCallState('active');
      callInfoRef.current = info;
      callStateRef.current = 'active';

      connectSocket().emit('call:accept', { conversationId, answer });
    } catch (err: unknown) {
      console.error('[WebRTC] acceptCall failed:', err);
      setCallError(err instanceof Error ? err.message : 'Failed to accept call');
      endCallAndCleanup(conversationId);
    }
  }, [getMedia, createPeer, flushIce, endCallAndCleanup]);

  const rejectCall = useCallback((conversationId: string) => {
    getSocket()?.emit('call:reject', { conversationId });
    fullCleanup();
  }, [fullCleanup]);

  const endCall = useCallback((conversationId: string) => {
    endCallAndCleanup(conversationId);
  }, [endCallAndCleanup]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoOff(!track.enabled);
  }, []);

  const stopScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const ls = localStreamRef.current;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    const camTrack = ls?.getVideoTracks()[0] ?? null;
    const sender = pc?.getSenders().find((s) => s.track?.kind === 'video' || s.track == null);
    if (sender) {
      await sender.replaceTrack(camTrack);
      if (!camTrack && callInfoRef.current?.mode === 'voice') {
        try {
          pc?.removeTrack(sender);
        } catch {
          /* ignore */
        }
      }
    }
    setScreenSharing(false);
    screenSharingRef.current = false;
    if (ls) setLocalStream(new MediaStream(ls.getTracks()));
    const info = callInfoRef.current;
    if (info) {
      getSocket()?.emit('call:media-state', {
        conversationId: info.conversationId,
        targetUserId: info.peerId,
        screenSharing: false,
      });
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const ls = localStreamRef.current;
    const info = callInfoRef.current;
    if (!pc || !ls || !info) return;

    if (screenSharingRef.current) {
      await stopScreenShare();
      return;
    }

    if (!canScreenShare()) {
      setCallError('Screen sharing is not available on this device');
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error('No screen track');

      let sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        sender = pc.addTrack(screenTrack, screenStream);
      }

      setScreenSharing(true);
      screenSharingRef.current = true;
      setLocalStream(new MediaStream([...ls.getAudioTracks(), screenTrack]));
      getSocket()?.emit('call:media-state', {
        conversationId: info.conversationId,
        targetUserId: info.peerId,
        screenSharing: true,
      });

      screenTrack.onended = () => {
        void stopScreenShare();
      };
    } catch (err: unknown) {
      console.error('[WebRTC] screen share failed:', err);
      setScreenSharing(false);
      screenSharingRef.current = false;
      if ((err as { name?: string })?.name !== 'NotAllowedError') {
        setCallError('Could not start screen share');
      }
    }
  }, [stopScreenShare]);

  useEffect(() => {
    if (callState === 'active') {
      setCallError(null);
      if (!durationTimerRef.current) {
        setCallDuration(0);
        durationTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      }
    }
  }, [callState]);

  useEffect(() => {
    const socket = connectSocket();

    const onRinging = (data: {
      conversationId: string;
      caller: { id: string; displayName: string; avatarUrl?: string | null };
      offer: unknown;
      mode?: string;
    }) => {
      if (callStateRef.current !== 'idle') {
        // Already in a call — auto-reject so we don't corrupt the live session
        socket.emit('call:reject', { conversationId: data.conversationId });
        return;
      }
      bufferedIceRef.current = [];
      setCallState('ringing');
      callStateRef.current = 'ringing';
      const info: CallInfo = {
        conversationId: data.conversationId,
        peerId: data.caller.id,
        peerName: data.caller.displayName,
        peerAvatar: data.caller.avatarUrl,
        mode: (data.mode as CallMode) || 'voice',
      };
      setCallInfo(info);
      callInfoRef.current = info;
      (window as unknown as { __pendingCallOffer?: unknown }).__pendingCallOffer = data.offer;
      (window as unknown as { __pendingCallPeerId?: string }).__pendingCallPeerId = data.caller.id;
      (window as unknown as { __pendingCallConvId?: string }).__pendingCallConvId = data.conversationId;
    };

    const onAccepted = (data: { conversationId: string; answer: unknown }) => {
      clearOutgoingTimer();
      const pc = pcRef.current;
      if (!pc) return;
      void pc
        .setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit))
        .then(() => flushIce())
        .catch((err) => console.error('[WebRTC] Failed to set answer:', err));
      setCallState('active');
      callStateRef.current = 'active';
    };

    const onRenegotiate = async (data: { conversationId: string; description: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      const info = callInfoRef.current;
      if (!pc || !info || info.conversationId !== data.conversationId || !data.description) return;
      try {
        const offerCollision =
          data.description.type === 'offer' && (makingOfferRef.current || pc.signalingState !== 'stable');
        if (offerCollision) {
          if (!politeRef.current) return;
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(data.description),
          ]);
        } else {
          await pc.setRemoteDescription(data.description);
        }
        await flushIce();
        if (data.description.type === 'offer') {
          await pc.setLocalDescription(await pc.createAnswer());
          socket.emit('call:renegotiate', {
            conversationId: info.conversationId,
            targetUserId: info.peerId,
            description: pc.localDescription,
          });
        }
      } catch (err) {
        console.error('[WebRTC] renegotiate handling failed:', err);
      }
    };

    const onMediaState = (data: { conversationId: string; screenSharing?: boolean }) => {
      if (data.conversationId !== callInfoRef.current?.conversationId) return;
      if (typeof data.screenSharing === 'boolean') setRemoteScreenSharing(data.screenSharing);
    };

    const onRejected = () => {
      clearOutgoingTimer();
      setCallError('Call rejected');
      setTimeout(() => fullCleanup(), 1500);
    };
    const onEnded = () => {
      clearOutgoingTimer();
      fullCleanup();
    };
    const onBusy = () => {
      clearOutgoingTimer();
      setCallError('User is in another call');
      setTimeout(() => fullCleanup(), 2000);
    };
    const onOffline = () => {
      clearOutgoingTimer();
      setCallError('User is offline');
      setTimeout(() => fullCleanup(), 2000);
    };

    const onCallIce = (data: { candidate: unknown }) => {
      if (!data.candidate) return;
      const candidate = data.candidate as RTCIceCandidateInit;
      const pc = pcRef.current;
      if (pc?.remoteDescription) {
        void pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      } else {
        bufferedIceRef.current.push(candidate);
      }
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ice', onCallIce);
    socket.on('call:busy', onBusy);
    socket.on('call:offline', onOffline);
    socket.on('call:ended', onEnded);
    socket.on('call:renegotiate', onRenegotiate);
    socket.on('call:media-state', onMediaState);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ice', onCallIce);
      socket.off('call:busy', onBusy);
      socket.off('call:offline', onOffline);
      socket.off('call:ended', onEnded);
      socket.off('call:renegotiate', onRenegotiate);
      socket.off('call:media-state', onMediaState);
    };
  }, [flushIce, fullCleanup, clearOutgoingTimer]);

  return {
    callState,
    callInfo,
    localStream,
    remoteStream,
    muted,
    videoOff,
    screenSharing,
    remoteScreenSharing,
    callError,
    callDuration,
    canScreenShare: canScreenShare(),
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
}
