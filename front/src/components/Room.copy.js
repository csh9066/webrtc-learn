import React, { useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import io, { Socket } from 'socket.io-client';

const Room = (props) => {
	const userVideo = useRef();
	const partnerVideo = useRef();
	const peerRef = useRef();
	const socketRef = useRef();
	const otherUser = useRef();
	const userStream = useRef();
	const { roomID } = useParams();

	useEffect(() => {
		navigator.mediaDevices
			.getUserMedia({ audio: true, video: true })
			.then((stream) => {
				userVideo.current.srcObject = stream;
				userStream.current = stream;

				socketRef.current = io.connect('http://localhost:3005/');
				socketRef.current.emit('join room', roomID);

				socketRef.current.on('other user', (userID) => {
					callUser(userID);
					otherUser.current = userID;
				});

				socketRef.current.on('user joined', (userID) => {
					otherUser.current = userID;
				});

				socketRef.current.on('offer', handleRecieveCall);

				socketRef.current.on('answer', handleAnswer);

				socketRef.current.on('ice-candidate', handleNewICECandidateMsg);
			});
	}, []);

	function callUser(userID) {
		console.log('피어 생성하고 피어에 스트림 추가');
		peerRef.current = createPeer(userID);
		userStream.current
			.getTracks()
			.forEach((track) => peerRef.current.addTrack(track, userStream.current));
	}

	function createPeer(userID) {
		const peer = new RTCPeerConnection({
			iceServers: [
				{
					urls: 'stun:stun.stunprotocol.org',
				},
				{
					urls: 'turn:numb.viagenie.ca',
					credential: 'muazkh',
					username: 'webrtc@live.com',
				},
			],
		});

		peer.onicecandidate = handleICECandidateEvent;
		peer.ontrack = handleTrackEvent;
		peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

		return peer;
	}

	function handleNegotiationNeededEvent(userID) {
		console.log('handleNegotiationNeededEvent');
		peerRef.current
			.createOffer()
			.then((offer) => {
				return peerRef.current.setLocalDescription(offer);
			})
			.then(() => {
				const payload = {
					target: userID,
					caller: socketRef.current.id,
					sdp: peerRef.current.localDescription,
				};
				console.log('offer 보냄');
				socketRef.current.emit('offer', payload);
			})
			.catch((e) => console.log(e));
	}

	function handleRecieveCall(incoming) {
		console.log('offer 받음');
		peerRef.current = createPeer();
		const desc = new RTCSessionDescription(incoming.sdp);
		peerRef.current
			.setRemoteDescription(desc)
			.then(() => {
				userStream.current
					.getTracks()
					.forEach((track) =>
						peerRef.current.addTrack(track, userStream.current)
					);
			})
			.then(() => {
				return peerRef.current.createAnswer();
			})
			.then((answer) => {
				return peerRef.current.setLocalDescription(answer);
			})
			.then(() => {
				const payload = {
					target: incoming.caller,
					caller: socketRef.current.id,
					sdp: peerRef.current.localDescription,
				};
				console.log('answer 보냄');
				socketRef.current.emit('answer', payload);
			});
	}

	function handleAnswer(message) {
		console.log('answer 받음');
		const desc = new RTCSessionDescription(message.sdp);
		peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
	}

	function handleICECandidateEvent(e) {
		if (e.candidate) {
			console.log('find iceCandidate');
			const payload = {
				caller: socketRef.current.id,
				target: otherUser.current,
				candidate: e.candidate,
			};
			socketRef.current.emit('ice-candidate', payload);
		}
	}

	function handleNewICECandidateMsg(incoming) {
		console.log('피어에 icecandidate 추가');
		const candidate = new RTCIceCandidate(incoming);

		peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
	}

	function handleTrackEvent(e) {
		console.log('handleTrackEvent');
		partnerVideo.current.srcObject = e.streams[0];
	}

	return (
		<div>
			<video autoPlay ref={userVideo} />
			<video autoPlay ref={partnerVideo} />
		</div>
	);
};

export default Room;
