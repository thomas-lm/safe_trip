/**
 * Nav
 * expose les différentes méthodes liées à la Navigation
 * 
 */
 //délai d'attente max pour une position
const GET_POS_TIMEOUT = 5000;
// age max de la dernière position
const MAX_POS_AGE = 1000;
// temps min entre 2 mise à jour
const MIN_TIME_BETWEEN_MAJ = 2000;
// distance min entre 2 mise à jour
const MIN_DIST_BETWEEN_MAJ = 2;

var geoPos, lastMajTS, lastMajCoord;

/**
 * Démarre la prise de position
 */ 
export function initGeoposition(onChange, onError) {
	if(navigator.geolocation) {
		stopGeoposition();
		geoPos = navigator.geolocation.watchPosition(
			function(position) {
				if(geoPos == undefined) {
					console.log('geolocalisation might not be stop correctly');
				}
				
				var currentTS = new Date().getTime();
				var change = true;
				if(lastMajTS) {
					if(currentTS-lastMajTS < MIN_TIME_BETWEEN_MAJ) {
						change = false;	
					} else {
						var d = distanceCoord(
							position.coords, lastMajCoord);
						if(d < MIN_DIST_BETWEEN_MAJ) {
							change = false;
						}
					}
				}
				
				if(change) {
					lastMajTS = currentTS;
					lastMajCoord = position.coords;
					onChange(position.coords);
				}
			}, function(err) {
				if(err.code == 1) {
	               onError("Error: GPS Access is denied!");
	            } else if( err.code == 2) {
	               onError("Error: Position is unavailable!");
	            }
			}, {
				enableHighAccuracy : true,
				timeout: GET_POS_TIMEOUT,
				maximumAge : MAX_POS_AGE
		});
	} else {
		onError('geolocalisation not supported');	
	}
}

/**
 * Stop la geolocalisation
 */ 
export function stopGeoposition() {
	if(geoPos != undefined) {
		navigator.geolocation.clearWatch(geoPos);
		geoPos = undefined;
	}
	lastMajTS = undefined;
	lastMajCoord = undefined;
}

/**
 * Retourne la distance en m entre 2 points
 * @param {*} coord1 point 1
 * @param {*} coord2 point 2
 */
export function distanceCoord(coord1, coord2) {
	var p1 = L.latLng(coord1.latitude, coord1.longitude);
	var p2 = L.latLng(coord2.latitude, coord2.longitude);
	return p1.distanceTo(p2);
}

/**
 * tri par date les records
 * @param {*} records 
 */
export function sortRecord(records) {
	records.sort(function(p1,p2){
		return p1.time - p2.time;
	});
}