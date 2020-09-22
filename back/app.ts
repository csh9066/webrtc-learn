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

type Rooms = {
	[room: string]: string[];
};

const rooms: Rooms = {};

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

io.on('connection', (socket: SocketIo.Socket) => {
	socket.on('join room', (roomID: string) => {
		if (rooms[roomID]) {
			rooms[roomID].push(socket.id);
		} else {
			rooms[roomID] = [socket.id];
		}
		console.log(rooms[roomID]);

		const otherUser = rooms[roomID].find((id) => id !== socket.id);
		if (otherUser) {
			socket.emit('other user', otherUser);
			socket.to(otherUser).emit('user join', socket.id);
		}
	});

	socket.on('offer', (payload) => {
		io.to(payload.target).emit('offer', payload);
	});

	socket.on('answer', (payload) => {
		io.to(payload.target).emit('answer', payload);
	});
});
