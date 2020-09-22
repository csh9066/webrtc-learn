import React from 'react';
import { Route, Switch } from 'react-router-dom';
import CreateRoom from './components/CreateRoom';
import Room from './components/Room';

function App() {
	return (
		<>
			<Switch>
				<Route path="/" exact component={CreateRoom} />
				<Route path="/room/:roomID" exact component={Room} />
			</Switch>
		</>
	);
}
export default App;
