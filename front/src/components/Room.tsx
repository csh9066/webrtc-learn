import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

type SdpPayload = {
	caller: string;
	callee: string;
	sdp: RTCSessionDescriptionInit;
};

type IcePayload = {
	target: string;
	source: string;
	candidate: RTCIceCandidate;
};

type RoomProps = {};

function Video({ peer }: { peer: RTCPeerConnection }) {
	const videoRef = useRef<HTMLVideoElement | null>(null);

	useEffect(() => {
		peer.ontrack = (e) => {
			console.log('마 개떼기야');

			if (e.streams) {
				videoRef.current!.srcObject = e.streams[0];
			}
		};
	}, []);
	return <video autoPlay ref={videoRef}></video>;
}

function Room(props: RoomProps) {
	const localVideo = useRef<HTMLVideoElement | null>(null);
	// peersRef의 peer id는 현재 연결 중인  아이디
	//caller는 callee 아이디, callee는 caller 아이디
	const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
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
			// socket 서버 접속
			socket.current = io.connect('http://localhost:3005/');

			socket.current.emit('join room', roomID);

			socket.current.on('ohter users', (users: string[]) => {
				users.forEach(async (user) => {
					const peer = await makeCaller(user, mediaStream);
				});
			});

			socket.current.on(
				'new-ice-candidate',
				async ({ source, candidate, target }: IcePayload) => {
					try {
						console.log(`${source}에게 candidate 받음 `);
						console.log(Object.keys(peersRef.current));

						const peer = peersRef.current[source];

						await peer.addIceCandidate(candidate);
						console.log('canddiate 추가 완료');
					} catch (e) {
						console.log(e);
					}
				}
			);

			// 콜리는 offer만 받음
			socket.current.on(
				'offer',
				async ({ callee, sdp, caller }: SdpPayload) => {
					console.log(`${callee}가 오퍼를 받았습니다 콜리를 생성 합니다`);

					await makeCallee({ callee, sdp, caller }, mediaStream);

					console.log(
						`peer에 rdp를 설정 했습니다. ${caller}에게 answer를 보냅니다`
					);
				}
			);

			// 콜러는 answer만 받음
			socket.current.on('answer', async ({ callee, sdp }: SdpPayload) => {
				console.log(`${callee}에게 answer를 받았습니다.`);
				const peer = peersRef.current[callee];

				if (peer) {
					await peer.setRemoteDescription(new RTCSessionDescription(sdp));
					console.log('peer에 sdp를 설정 합니다');
				}
			});
		})();
	}, []);

	async function makeCaller(callee: string, stream: MediaStream) {
		const peer: RTCPeerConnection = new RTCPeerConnection();
		peersRef.current[callee] = peer;
		setPeers((prevState) => [...prevState, peer]);
		stream.getTracks().forEach((track) => {
			peer.addTrack(track, stream);
		});

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
				socket.current?.emit('new-ice-candidate', {
					source: socket.current.id,
					target: callee,
					candidate: e.candidate,
				});
			}
		};
		return peer;
	}

	async function makeCallee(
		{ caller, callee, sdp }: SdpPayload,
		stream: MediaStream
	) {
		const peer: RTCPeerConnection = new RTCPeerConnection();
		peersRef.current[caller] = peer;
		setPeers((prevState) => [...prevState, peer]);

		stream.getTracks().forEach((track) => {
			peer.addTrack(track, stream);
		});

		peer.ontrack = (e) => {
			console.log('마 개떼기야');
		};

		await peer.setRemoteDescription(new RTCSessionDescription(sdp));

		const answer = await peer.createAnswer();
		await peer.setLocalDescription(answer);

		peer.onicecandidate = (e) => {
			if (e.candidate) {
				socket.current?.emit('new-ice-candidate', {
					source: socket.current.id,
					target: caller,
					candidate: e.candidate,
				});
			}
		};

		socket.current?.emit('answer', {
			caller,
			callee,
			sdp: peer.localDescription,
		});
		return peer;
	}

	return (
		<div>
			<video autoPlay ref={localVideo} />
			{peers.map((peer, i) => (
				<Video peer={peer} key={i} />
			))}
		</div>
	);
}

export default Room;
