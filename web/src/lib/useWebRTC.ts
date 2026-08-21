import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket, getSocket } from './socket';

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type CallState = 'idle' | 'ringing' | 'outgoing' | 'active';
export type CallMode = 'voice' | 'video';

interface CallInfo {
  conversationId: string;
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
  const callInfoRef = useRef<{ peerId: string } | null>(null);
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
  }, []);

  const setupPeer = useCallback((pc: RTCPeerConnection, conversationId: string, targetUserId: string) => {
    const remote = new MediaStream();
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket()?.emit('call:ice', { conversationId, targetUserId, candidate: e.candidate });
      }
    };
  }, []);

  const startCall = useCallback(async (conversationId: string, peerId: string, peerName: string, peerAvatar?: string | null, mode: CallMode = 'voice') => {
    currentModeRef.current = mode;
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: mode === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    callInfoRef.current = { peerId };
    setupPeer(pc, conversationId, peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    setCallState('outgoing');
    setCallInfo({ conversationId, peerName, peerAvatar, mode });

    const socket = connectSocket();
    socket.emit('call:init', { conversationId, calleeId: peerId, offer });
  }, [setupPeer]);

  const acceptCall = useCallback(async (conversationId: string, peerName: string, peerAvatar: string | null | undefined, offer: unknown, mode: CallMode = 'voice') => {
    currentModeRef.current = mode;
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: mode === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection(STUN_SERVERS);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    setupPeer(pc, conversationId, callInfoRef.current?.peerId ?? '');

    await pc.setRemoteDescription(new RTCSessionDescription(offer as RTCSessionDescriptionInit));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    setCallState('active');
    setCallInfo({ conversationId, peerName, peerAvatar, mode });

    const socket = connectSocket();
    socket.emit('call:accept', { conversationId, answer });
  }, [setupPeer]);

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
    const localStream = localStreamRef.current;
    if (!pc || !localStream) return;

    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const cameraTrack = localStream.getVideoTracks()[0];
      if (cameraTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        sender?.replaceTrack(cameraTrack);
      }
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
        const camTrack = localStream.getVideoTracks()[0];
        if (camTrack) {
          const s = pc.getSenders().find((x) => x.track?.kind === 'video');
          s?.replaceTrack(camTrack);
        }
        screenStreamRef.current = null;
        setScreenSharing(false);
        setLocalStream(new MediaStream(pc.getSenders().map((s) => s.track).filter(Boolean) as MediaStreamTrack[]));
      };
    } catch {
      setScreenSharing(false);
    }
  }, [screenSharing]);

  useEffect(() => {
    const socket = connectSocket();

    const onRinging = (data: { conversationId: string; caller: { id: string; displayName: string; avatarUrl?: string | null }; offer: unknown }) => {
      callInfoRef.current = { peerId: data.caller.id };
      setCallState('ringing');
      setCallInfo({
        conversationId: data.conversationId,
        peerName: data.caller.displayName,
        peerAvatar: data.caller.avatarUrl,
        mode: 'voice',
      });
      (window as any).__pendingCallOffer = data.offer;
      (window as any).__pendingCallConversationId = data.conversationId;
    };

    const onAccepted = (data: { conversationId: string; answer: unknown }) => {
      if (pcRef.current) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer as RTCSessionDescriptionInit)).catch(() => {});
      }
      setCallState('active');
    };

    const onRejected = () => {
      setCallState('idle');
      setCallInfo(null);
      cleanup();
    };

    const onCallIce = (data: { candidate: unknown }) => {
      if (pcRef.current && data.candidate) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit)).catch(() => {});
      }
    };

    const onEnded = () => {
      setCallState('idle');
      setCallInfo(null);
      cleanup();
    };

    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ice', onCallIce);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:ringing', onRinging);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ice', onCallIce);
      socket.off('call:ended', onEnded);
    };
  }, [cleanup]);

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
    callInfoRef,
  };
}
