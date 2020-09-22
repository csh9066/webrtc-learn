import { Socket } from 'dgram';
import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
type RoomProps = {};

function Room(props: RoomProps) {
	const localVideo = useRef<HTMLVideoElement | null>(null);
	const remoteVideo = useRef<HTMLVideoElement | null>(null);
	const localStream = useRef<MediaStream | null>(null);
	const remoteStream = useRef<MediaStream | null>(null);
	const peer = useRef<RTCPeerConnection | null>(null);
	const sokcet = useRef<SocketIOClient.Socket | null>(null);
	const remoteUser = useRef<string | null>(null);

	const { roomID } = useParams<{ roomID: string }>();

	useEffect(() => {
		(async () => {
			// 시작하면 getUserMedia를 통해 자기 자신 오디오랑 비디오 연결하기
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			});
			localVideo.current!.srcObject = mediaStream;
			localStream.current = mediaStream;

			// socket 서버 접속
			sokcet.current = io.connect('http://localhost:3005/');
			sokcet.current.emit('join room', roomID);

			// 다른 유저가 접속 하면
			sokcet.current.on('other user', async (userID: string) => {
				// //create peerConnection
				peer.current = new RTCPeerConnection();

				peer.current.onicecandidate = (e) => {
					if (e.candidate) {
						const payload: { target: string; candidate: RTCIceCandidate } = {
							target: remoteUser.current!,
							candidate: e.candidate,
						};
						sokcet.current?.emit('ice-candidate', payload);
					}
				};

				peer.current.addEventListener('track', (e: RTCTrackEvent) => {
					remoteVideo.current!.srcObject = e.streams[0];
				});

				peer.current.addEventListener('negotiationneeded', async (e) => {
					const offer = await peer.current!.createOffer();
					peer.current?.setLocalDescription(offer);
					const payload: {
						target: string;
						caller: string;
						sdp: RTCSessionDescription | null;
					} = {
						target: userID,
						caller: sokcet.current!.id,
						sdp: peer.current!.localDescription,
					};
					sokcet.current?.emit('offer', payload);
				});

				localStream.current?.getVideoTracks().forEach((track) => {
					peer.current?.addTrack(track);
				});

				remoteUser.current = userID;
			});

			sokcet.current.on('user join', (userID: string) => {
				remoteUser.current = userID;
			});

			sokcet.current.on('offer', () => {});
			sokcet.current.on('answer', () => {});
			sokcet.current.on('ice-candidate', () => {});
		})();
	}, []);

	return (
		<div>
			<video autoPlay ref={localVideo} />
			<video autoPlay ref={remoteVideo} />
		</div>
	);
}

export default Room;
