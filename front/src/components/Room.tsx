import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

type Payload = {
	caller: string;
	calle: string;
	sdp: RTCSessionDescriptionInit;
};

type RoomProps = {};

function Room(props: RoomProps) {
	const localVideo = useRef<HTMLVideoElement | null>(null);
	const localStream = useRef<MediaStream | null>(null);
	// peersRef의 id는 caller는 callee 아이디, callee는 caller 아이디
	const peersRef = useRef<{ id: string; peer: RTCPeerConnection }[]>([]);
	const [peers, setPeers] = useState<RTCPeerConnection[]>([]);
	const socket = useRef<SocketIOClient.Socket | null>(null);

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
			socket.current = io.connect('http://localhost:3005/');
			socket.current.emit('join room', roomID);

			socket.current.on('ohter users', (users: string[]) => {
				users.forEach(async (user) => {
					const peer = await makeCaller(user);
					peersRef.current.push({ id: user, peer });

					setPeers((prevState) => [...prevState, peer]);
				});
			});

			socket.current.on('new-ice-candidate', async () => {});

			// 콜리는 offer만 받음
			socket.current.on('offer', async ({ calle, sdp, caller }: Payload) => {
				const peer = await makeCallee(caller);
				peersRef.current.push({ id: caller, peer });

				setPeers((prevState) => [...prevState, peer]);

				await peer.setRemoteDescription(new RTCSessionDescription(sdp));

				socket.current?.emit('answer', {
					caller,
					calle,
					sdp: peer.localDescription,
				});
			});

			// 콜러는 answer만 받음
			socket.current.on('answer', async ({ calle, sdp }: Payload) => {
				const peerObj = peersRef.current.find((peer) => peer.id === calle);
				if (peerObj) {
					const peer = peerObj.peer;
					await peer.setRemoteDescription(new RTCSessionDescription(sdp));
				}
			});
		})();
	}, []);

	async function makeCaller(callee: string) {
		const peer: RTCPeerConnection = new RTCPeerConnection();
		const offer = await peer.createOffer();
		await peer.setLocalDescription(offer);
		socket.current?.emit('offer', {
			// 콜리는 오퍼를 받는 사람 콜러는 나
			caller: socket.current.id,
			callee,
			sdp: offer,
		});
		peer.onicecandidate = (e) => {
			if (e.candidate) {
				// socket.emit('new-ice-candidate',)
			}
		};
		return peer;
	}

	async function makeCallee(caller: string) {
		const peer: RTCPeerConnection = new RTCPeerConnection();
		const answer = await peer.createAnswer();
		await peer.setLocalDescription(answer);
		socket.current?.emit('answer', {
			caller,
			calle: socket.current.id,
			sdp: answer,
		});
		return peer;
	}

	return (
		<div>
			<video autoPlay ref={localVideo} />
			{/* {
				peers.map((peer) => {
					<video autoPlay ref={localVideo} />
				})
			} */}
		</div>
	);
}

export default Room;
