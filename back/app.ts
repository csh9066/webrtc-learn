import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import http from 'http';
import morgan from 'morgan';
import SocketIo from 'socket.io';

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser('asd'));
app.use(
	session({
		resave: false,
		saveUninitialized: false,
		secret: 'asd',
		cookie: {
			httpOnly: true,
			secure: false,
		},
	})
);

app.use((req, res) => {
	console.log('good');
});

const server = http.createServer(app);
const io = SocketIo(server);

server.listen(3005, () => {
	console.log(`sever running http://localhost:3005`);
});

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

io.use((socket: SocketIo.Socket, next) => {
	session({
		resave: false,
		saveUninitialized: false,
		secret: 'asd',
		cookie: {
			httpOnly: true,
			secure: false,
		},
	})(socket.request, socket.request.res, next);
});

io.on('connection', (socket) => {
	let roomID: string;
	socket.on('join room', (roomID: string) => {
		roomID = roomID;
		socket.join(roomID);

		// 자신을 제외한 방안에 있는 유저들
		const ohterUsers = Object.keys(socket.adapter.rooms[roomID].sockets).filter(
			(id) => socket.id !== id
		);

		if (ohterUsers.length !== 0) {
			socket.emit('ohter users', ohterUsers);
		}

		// socket.broadcast.to(roomID).emit('user joined', socket.id);
	});

	socket.on('offer', ({ callee, caller, sdp }: SdpPayload) => {
		io.to(callee).emit('offer', { callee, caller, sdp });
	});

	socket.on('answer', ({ caller, sdp, callee }: SdpPayload) => {
		io.to(caller).emit('answer', { caller, callee, sdp });
	});

	socket.on(
		'new-ice-candidate',
		({ target, candidate, source }: IcePayload) => {
			console.log(target, source);

			io.to(target).emit('new-ice-candidate', { target, candidate, source });
		}
	);
});
