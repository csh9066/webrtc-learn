import React from 'react';
import { useHistory } from 'react-router-dom';
import { v4 as uuid } from 'uuid';

type CreateRoomProps = {};

function CreateRoom(props: CreateRoomProps) {
	const history = useHistory();

	const onCreate = () => {
		const id = uuid();
		history.push(`/room/${id}`);
	};
	return <button onClick={onCreate}>Create Room</button>;
}

export default CreateRoom;
