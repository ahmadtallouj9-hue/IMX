import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket, getSocket } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

export type CallState = 'idle' | 'ringing' | 'outgoing' | 'active';
export type CallMode = 'voice' | 'video';

interface CallInfo {
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const callInfoRef = useRef<CallInfo | null>(null);
  const pendingOfferRef = useRef<unknown>(null);
  const pendingConversationIdRef = useRef<string | null>(null);
  const bufferedIceRef = useRef<RTCIceCandidateInit[]>([]);
  const currentModeRef = useRef<CallMode>('voice');

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setVideoOff(false);
    setScreenSharing(false);
    bufferedIceRef.current = [];
  }, []);

  const flushBufferedIce = useCallback(() => {
    const pc = pcRef.current;
    const info = callInfoRef.current;
    if (!pc || !info) return;
    for (const candidate of bufferedIceRef.current) {
      pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
    bufferedIceRef.current = [];
  }, []);

  const setupPeer = useCallback((pc: RTCPeerConnection, conversationId: string, targetUserId: string) => {
    const remote = new MediaStream();

    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket()?.emit('call:ice', { conversationId, targetUserId, candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'failed' || state === 'disconnected') {
        setCallState('idle');
        setCallInfo(null);
        callInfoRef.current = null;
        cleanup();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setCallState('active');
      }
    };
  }, [cleanup]);

  const getMedia = useCallback(async (mode: CallMode) => {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: mode === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone permission denied'
        : err?.name === 'NotFoundError'
          ? 'No microphone found'
          : `Media error: ${err?.message ?? err}`;
      throw new Error(msg);
    }
  }, []);

  const startCall = useCallback(async (conversationId: string, peerId: string, peerName: string, peerAvatar?: string | null, mode: CallMode = 'voice') => {
    currentModeRef.current = mode;

    const stream = await getMedia(mode);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const info: CallInfo = { conversationId, peerId, peerName, peerAvatar, mode };
    callInfoRef.current = info;
    setupPeer(pc, conversationId, peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    setCallState('outgoing');
    setCallInfo(info);

    const socket = connectSocket();
    socket.emit('call:init', { conversationId, calleeId: peerId, offer });
  }, [getMedia, setupPeer]);

  const acceptCall = useCallback(async (conversationId: string, peerId: string, peerName: string, peerAvatar: string | null | undefined, offer: unknown, mode: CallMode = 'voice') => {
    currentModeRef.current = mode;

    const stream = await getMedia(mode);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const info: CallInfo = { conversationId, peerId, peerName, peerAvatar, mode };
    callInfoRef.current = info;
    setupPeer(pc, conversationId, peerId);

    await pc.setRemoteDescription(new RTCSessionDescription(offer as RTCSessionDescriptionInit));

    flushBufferedIce();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    setCallState('active');
    setCallInfo(info);

    const socket = connectSocket();
    socket.emit('call:accept', { conversationId, answer });
  }, [getMedia, setupPeer, flushBufferedIce]);

  const rejectCall = useCallback((conversationId: string) => {
    getSocket()?.emit('call:reject', { conversationId });
    setCallState('idle');
    setCallInfo(null);
    callInfoRef.current = null;
    pendingOfferRef.current = null;
    pendingConversationIdRef.current = null;
    cleanup();
  }, [cleanup]);

  const endCall = useCallback((conversationId: string) => {
    getSocket()?.emit('call:end', { conversationId });
    setCallState('idle');
    setCallInfo(null);
    callInfoRef.current = null;
    pendingOfferRef.current = null;
    pendingConversationIdRef.current = null;
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoOff(!videoTrack.enabled);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    const ls = localStreamRef.current;
    if (!pc || !ls) return;

    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const cameraTrack = ls.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(cameraTrack ?? null);
      setScreenSharing(false);
      setLocalStream(new MediaStream(pc.getSenders().map((s) => s.track).filter(Boolean) as MediaStreamTrack[]));
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(screenTrack);
      setScreenSharing(true);
      setLocalStream(new MediaStream(pc.getSenders().map((s) => s.track).filter(Boolean) as MediaStreamTrack[]));

      screenTrack.onended = () => {
        const camTrack = ls.getVideoTracks()[0];
        const s = pc.getSenders().find((x) => x.track?.kind === 'video');
        s?.replaceTrack(camTrack ?? null);
        screenStreamRef.current = null;
        setScreenSharing(false);
        setLocalStream(new MediaStream(pc.getSenders().map((x) => x.track).filter(Boolean) as MediaStreamTrack[]));
      };
    } catch {
      setScreenSharing(false);
    }
  }, [screenSharing]);

  useEffect(() => {
    const socket = connectSocket();

    const onRinging = (data: { conversationId: string; caller: { id: string; displayName: string; avatarUrl?: string | null }; offer: unknown }) => {
      const info: CallInfo = {
        conversationId: data.conversationId,
        peerId: data.caller.id,
        peerName: data.caller.displayName,
        peerAvatar: data.caller.avatarUrl,
        mode: 'voice',
      };
      callInfoRef.current = info;
      pendingOfferRef.current = data.offer;
      pendingConversationIdRef.current = data.conversationId;
      bufferedIceRef.current = [];
      setCallState('ringing');
      setCallInfo(info);
    };

    const onAccepted = (data: { conversationId: string; answer: unknown }) => {
      if (pcRef.current) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit))
          .then(() => flushBufferedIce())
          .catch(() => {});
      }
      setCallState('active');
    };

    const onRejected = () => {
      setCallState('idle');
      setCallInfo(null);
      callInfoRef.current = null;
      cleanup();
    };

    const onCallIce = (data: { candidate: unknown }) => {
      if (pcRef.current && data.candidate) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit)).catch(() => {});
      } else if (data.candidate) {
        bufferedIceRef.current.push(data.candidate as RTCIceCandidateInit);
      }
    };

    const onCallBusy = () => {
      setCallState('idle');
      setCallInfo(null);
      callInfoRef.current = null;
      cleanup();
    };

    const onCallOffline = () => {
      setCallState('idle');
      setCallInfo(null);
      callInfoRef.current = null;
      cleanup();
    };

    const onEnded = () => {
      setCallState('idle');
      setCallInfo(null);
      callInfoRef.current = null;
      cleanup();
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ice', onCallIce);
    socket.on('call:busy', onCallBusy);
    socket.on('call:offline', onCallOffline);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ice', onCallIce);
      socket.off('call:busy', onCallBusy);
      socket.off('call:offline', onCallOffline);
      socket.off('call:ended', onEnded);
    };
  }, [cleanup, flushBufferedIce]);

  return {
    callState,
    callInfo,
    localStream,
    remoteStream,
    muted,
    videoOff,
    screenSharing,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    pendingOffer: pendingOfferRef,
    pendingConversationId: pendingConversationIdRef,
  };
}
