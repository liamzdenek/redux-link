import { Subject } from 'rxjs/Subject';
import { map } from 'rxjs/operator/map';
import { filter } from 'rxjs/operator/filter';
import { mergeMap } from 'rxjs/operator/mergeMap';
import { _do } from 'rxjs/operator/do';
import { retryWhen } from 'rxjs/operator/retryWhen';
import { ignoreElements } from 'rxjs/operator/ignoreElements';
import { delay } from 'rxjs/operator/delay';
import { defer } from 'rxjs/observable/defer';
import { QueueingSubject } from 'queueing-subject';
import websocketConnect from 'rxjs-websockets';

const INCOMING = '@link/INCOMING';
const OUTGOING = '@link/OUTGOING';
const BROADCAST = '@link/BROADCAST';

export function incomingWS(action, name){ return { action, type: INCOMING, name } } 
export function outgoingWS(action, name){ return { action, type: OUTGOING, name } } 
export function broadcastWS(action){ return { action, type: BROADCAST } } 

export function createLinkMiddleware(options) {
	const defaultOptions = {
		//wsFactory: (uri) => new WebSocket(uri),
		protocols: undefined,
		backoff: (errros$) => errors$::delay(1000)::_do((e) => console.log("Restarting due to error", e)),
	};

	options = Object.assign({}, defaultOptions, options);

	const fromRedux$ = new QueueingSubject();
	const fromWS$ = new Subject();

	const linkMiddleware = ({dispatch, getState }) => next => {
		fromWS$
			::_do((message) => {
				console.log("GOT: ", message);
			})
			.subscribe(dispatch);
		return action => {
			const result = next(action);
			if(action.type === OUTGOING || action.type === BROADCAST) {
				console.log("Sending to fromRedux:", action);
				fromRedux$.next(action);
			}
			return result;
		}
	}

	linkMiddleware.connect = (uri, name) => {
		const output$ =fromRedux$
			::filter((action) => {
				// broadcasts automatically sent to all connected WS
				if(action.type === BROADCAST) { return true; }

				// only send OUTGOING if the name field is not provided (assume they meant broadcast), or the name is a match
				else if(action.type === OUTGOING){
					return typeof(name) === 'undefined' || action.name === name
				}
				return false
			})
			::map((action) => JSON.stringify(action.action))
			::_do((e) => console.log("Sending", e));
		const {messages:messages$, connectionStatus:connectionStatus$} = websocketConnect(uri, output$, options.protocols, options.wsFactory);
		return messages$
			::_do((message) => {
				//console.log("From WS: ", message);
				fromWS$.next(incomingWS(JSON.parse(message)));
			})
			::retryWhen(errors$ => errors$.let(options.backoff))
			::ignoreElements()
	}
	
	return linkMiddleware;
}
