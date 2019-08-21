/**
 * Comm
 * expose les différentes méthodes d'accès au données local
 * 
 */

const CLE_CURRENT_TRACK = 'current-track';
const CLE_HISTORY_TRACK = 'history-track';


/**
 * retourne la track courante si elle n'a pas été stopée
 */ 
export function getCurrentTrack() {
	var track = window.localStorage.getItem(CLE_CURRENT_TRACK);
	if(track) {
		return JSON.parse(track);
	}
	return undefined;
}

/**
 * Définit la track courante
 */ 
export function setCurrentTrack(track) {
	if(track) {
		window.localStorage.setItem(CLE_CURRENT_TRACK,JSON.stringify(track));	
	}
}

/**
 * supprime la track courante
 */ 
export function removeCurrentTrack() {
	window.localStorage.removeItem(CLE_CURRENT_TRACK);
}

/**
 * ajoute une track dans l'historique
 */ 
export function addTrackToHistory(track) {
	if(track) {
		var history = [];
		var historyJS = window.localStorage.getItem(CLE_HISTORY_TRACK);	
		if(historyJS) {
			history = JSON.parse(historyJS);
		}
		history.push(track);
		window.localStorage.setItem(CLE_HISTORY_TRACK, JSON.stringify(history));	
	}
}
