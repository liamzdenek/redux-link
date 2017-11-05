import 'rxjs';
import { createStore, applyMiddleware } from 'redux';
import { createLinkMiddleware } from './index.js';
import WebSocket from 'ws';

const options = {
	wsFactory: (uri) => new WebSocket(uri),
}

const linkMiddleware = createLinkMiddleware(options);

linkMiddleware
	.connect('ws://demos.kaazing.com/echo')
	.subscribe(
		(v) => console.log("Got:", v),
		(err) => console.log("Error:", err),
		() => console.log("Closed"),
	);

const store = createStore(
	(state, action) => {
		console.log("Got action in reducer", action);
		return { dummy: 'haha' }
	},
	null,
	applyMiddleware(
		linkMiddleware
	)
);

import { outgoingWS } from './index.js';
store.dispatch(outgoingWS({type: "TESTSHARE", data: "haha"}));
