import * as Comm from './utils/comm.js';
import * as Mem from './utils/mem.js';
import * as Nav from './utils/nav.js';
import * as Map from './utils/map.js';

/*
 * Module principal de l'application
 * TODO :
 * - lister les 10 derniers parcours public
 * - arrière plan
 * - voir l'historique local des parcours
 */
const CHAINE_PARAM_VIEW = '?view=';

var status;
var loader, positionsNotSave, currentTrack;

/*
	* Reset l'application et retourne sur la page d'accueil
	*/
function resetApp() {

	//Stop la geo
	Nav.stopGeoposition();

	//Stop le tracking
	status = 'idle';

	//Supprime les sauvegardes
	positionsNotSave = [];
	currentTrack = undefined;

	//Reset la map
	Map.reset();

	//réinitialise les classes
	document.getElementById('start-screen').classList.remove('open');
	document.getElementById('wellcome-screen').classList.remove('open');
	document.getElementById('map-screen').classList.remove('open');
	document.getElementById('btn-private').classList.add('active');
	document.getElementById('btn-public').classList.remove('active');
	document.getElementById('btn-start').setAttribute('disabled','disabled');
	document.getElementById('btn-start').value = 'Start';
	document.getElementById('btn-stop').classList.remove('active');
	document.getElementById('in-name').value = '';
	document.getElementById('in-url-share').value='';
}

/*
	* sauvegarde la position actuelle dans un tableau et synchronise en ligne
	*/
function savePosition(coord) {
	var ts = new Date().getTime();
	var arrVar = {
		time: ts,
		latitude: coord.latitude,
		longitude: coord.longitude
	};
	Map.newPosition(coord, ts);
	
	positionsNotSave.push(arrVar);
	if(currentTrack) {
		var data = {records : positionsNotSave }
		Comm.post('records/'+currentTrack.id+'/'+currentTrack.editkey, data, function(resp) {
			//Succes
			positionsNotSave = [];
		}, function(resp) {
			//TODO Géré les erreurs
		});	
	} else {
		console.log('pas de track, positions non envoyées');
	}
}

/**
 * Rafraichi la vue de suivit
 * @param {*} trackID 
 * @param {*} lastTime 
 */
function refreshView(trackID, lastTime) {
	Comm.get('records/' + trackID + '/'+lastTime, function(resp) {
		if(resp.records) {
			Nav.sortRecord(resp.records);

			resp.records.forEach(coord => {
				Map.newPosition(coord);
				lastTime = coord.time;
			});
		}
		setTimeout(function(){
			refreshView(trackID,lastTime);
		},4000);
	}, function() {
		setTimeout(function(){
			refreshView(trackID,lastTime);
		},4000);
	});
}

/**
 * Démarre la map en mode suivit
 * @param {*} trackID 
 */
function startView(trackID) {
	Comm.get('track/' + trackID, function(resp) {
		//Succes
		if(resp.respt) {
			var track = resp.respt;
			if(track.records.length > 0) {
				Nav.sortRecord(track.records);
				Map.initialize(track.records[track.records.length-1].latitude,track.records[track.records.length-1].longitude,track.name);
				document.getElementById('map-screen').classList.add('open');
				Map.loadPositionsFirst(resp.respt.records);
				
				var lastTime = track.records[track.records.length-1].time;

				//Initialiser le timer de raffraichissement
				setTimeout(function(){
					refreshView(trackID,lastTime);
				},2500);
			} else {
				alert('user not have been started currently');
			}
		} else {
			alert('unknown track');
		}
	}, function(resp) {
		alert('unknown track');
	});	
}

/*
 * Initialise la localisation, et affiche la map
 */
function startTrip(onInit) {
	//Affichage du loader
	loader.classList.add('active');
	
	//Initialise le tableau de position
	positionsNotSave = [];
	status = 'wait';
	
	//recuperation de la localisation
	Nav.initGeoposition(
		function(coord) {
			if(status == 'wait') {
				status = 'intrip';
				
				//Initialise la map
				Map.initialize(coord.latitude,coord.longitude, currentTrack.name);
			
				//affiche la map
				loader.classList.remove('active');
				document.getElementById('map-screen').classList.add('open');
				document.getElementById('start-screen').classList.remove('open');
				document.getElementById('wellcome-screen').classList.remove('open');
				document.getElementById('btn-stop').classList.add('active');
				onInit();
			}
			
			if(status == 'intrip') {
				//sauvegarde la position de départ
				savePosition(coord);
			}
		},function(msg) {
			//Erreur
			alert(msg);
			Nav.stopGeoposition();
		});
}

/*
 * termine la géolocalisation
 */
function stopTrip() {
	Mem.addTrackToHistory(currentTrack);
	Mem.removeCurrentTrack();
	resetApp();
}

/**
 * Récupère les données d'un nouveau parcours coté serveur
 */
function getNewTrack() {
	var currentTS = new Date().getTime();
	Comm.get('newTrack/' + currentTS, function(resp) {
		//Succes
		currentTrack = resp;
		document.getElementById('in-url-share').value=Comm.getUrlClient() + CHAINE_PARAM_VIEW + currentTrack.id;
		document.getElementById('btn-start').removeAttribute('disabled');
	}, function(resp) {
		currentTrack = undefined;
		document.getElementById('btn-start').value = 'Start offline';
		document.getElementById('btn-start').removeAttribute('disabled');
	});		
}

/**
 * met à jour les données de base du parcours (nom, public)
 */
function initSrvTrack() {
	if(currentTrack) {
		currentTrack.name = document.getElementById('in-name').value;
		currentTrack.public = document.getElementById('btn-public').classList.contains('active');
		Comm.post('track', currentTrack, function(resp) {
			//Sauvegarde ce trip
			Mem.setCurrentTrack(currentTrack)
		}, function(resp) {
			console.log('SAVE ERROR');
		});	
	}
}

/**
 * ajoute les points sur la map d'un parcours existant
 */ 
function loadExistingTrack(id) {
	Comm.get('track/' + id, function(resp) {
		//Succes
		if(resp.respt) {
			Map.loadPositionsFirst(resp.respt.records);
		}
	}, function(resp) {
		//TODO Géré les erreurs
	});	
}

/*
	* Initialise les premiers composants de la page
	*/
export function initApp() {
	status = 'idle';
	resetApp();

	//bouton nouveau trip
	var btnNewtrip = document.getElementById('btn-newtrip');
	
	btnNewtrip.addEventListener('click',function(){
		if(!document.getElementById('start-screen').classList.contains('open')) {

			document.getElementById('start-screen').classList.add('open');
			document.getElementById('wellcome-screen').classList.add('open');
			getNewTrack();
		}
	});
	
	//bouton privé / public
	var btnPublic = document.getElementById('btn-public');
	var btnPrivate = document.getElementById('btn-private');
	btnPublic.addEventListener('click', function(){
		btnPublic.classList.toggle('active');
		btnPrivate.classList.toggle('active');
	});
	btnPrivate.addEventListener('click', function(){
		btnPublic.classList.toggle('active');
		btnPrivate.classList.toggle('active');
	});
	
	//bouton démarrer
	var btnStart = document.getElementById('btn-start');
	btnStart.addEventListener('click',function() {
		initSrvTrack();
		startTrip(function(){});
	});

	var btnStop = document.getElementById('btn-stop');
	btnStop.addEventListener('click',function() {
		stopTrip();
	});
	
	var btnShare = document.getElementById('btn-share');
	btnShare.addEventListener('click',function() {
		if(navigator && navigator.share) {
			navigator.share(document.getElementById('in-url-share').value,'share my trip','plain/text')
		}
	});
	
	loader = document.getElementById('loader');
	var idxLocView = window.location.href.indexOf(CHAINE_PARAM_VIEW);
	if(idxLocView != -1) {
		//Url d'accès directe à une course
		startView(window.location.href.substring(idxLocView + CHAINE_PARAM_VIEW.length));
	} else {
		//Detection de la derniere course 
		var lastTrack = Mem.getCurrentTrack();
		if(lastTrack && confirm('last session was not finished. Do you want to retrieve it ?')) {
			loader.classList.add('active');
			//Charger la derniere track
			currentTrack = lastTrack;
			startTrip(function(){
				//Charge les anciennes traces
				loadExistingTrack(currentTrack.id);
			});
		}
	}
}

document.addEventListener("DOMContentLoaded", function(event) {
	initApp();
});
