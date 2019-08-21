import * as Nav from './nav.js';
import * as Format from './format.js';

/**
 * Nav
 * expose les différentes méthodes liées à la map
 * 
 */

var map, mark, positions, distanceTotale, info;

/**
 * initialise la map OSM
 * @param {*} latitude position initiale 
 * @param {*} longitude position initiale
 * @param {*} name nom du parcours
 */
export function initialize(latitude, longitude, name) {
	reset();
	//initialise la map
	map = new L.Map('map-screen', {
		center: [latitude,longitude],
		zoom: 18,
		zoomControl: false
	});
		
	let osmUrl='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
	let osmAttrib='© http://openstreetmap.org contributors';
	let osm = new L.TileLayer(osmUrl, {minZoom: 10, maxZoom: 18, attribution: osmAttrib});
	map.doubleClickZoom.disable()
	map.addLayer(osm);

	//initialise le marker
	mark = L.marker([latitude,longitude]);
	mark.addTo(map).bindPopup('Current position');

	//Initialise la zone info
	info = L.control();

	info.onAdd = function (map) {
		this._div = L.DomUtil.create('div', 'info');
		this.update(0);
		return this._div;
	};

	info.update = function () {
		var now = new Date().getTime();
		var dureeTotale = 0;
		if(positions.length > 0) {
			dureeTotale = now - positions[0].time;
		}

		var vitesseMoyenne = 0;
		if(dureeTotale > 0) {
			vitesseMoyenne = 1000 * distanceTotale / dureeTotale;
		}

		//calcule la vitesse courante m/s (on prend la distance des deux dernier point sur le temps entre maintenant et l'avant dernier point)
		var vitesseCourante = 0;
		if(positions.length > 1) {
			var temps = now - positions[positions.length - 2].time;
			var distance = Nav.distanceCoord(positions[positions.length - 1], positions[positions.length - 2]);
			vitesseCourante = 1000 * distance / temps; 
		}

		var titre = name?'<b>'+name+'</b><br>':'';
		//TODO Faire une lib utilitaire pour les transformations vitesse, distance et temps
		this._div.innerHTML = '<p>' + titre +
				'Vi = ' + Format.formatVitesse(vitesseCourante) +'<br>' +
				'Vm = ' + Format.formatVitesse(vitesseMoyenne)+'<br>' +
				'T = ' + Format.formatDuree(dureeTotale)+'<br>' +
				'd = ' + Format.formatDistance(distanceTotale) +
				'</p>';
	};

	info.addTo(map);

	//Démarrage du rafraichissement de l'info
	var refreshInfo = function() {
		if(info) {
			info.update();
			setTimeout(refreshInfo,1000);
		}
	};
	refreshInfo();
}

/**
 * Reset la map en supprimant l'ensemble des données
 */
export function reset() {
	positions = [];
	distanceTotale = 0;

	if(mark) {
		mark.remove();
		mark = undefined;
	}
	if(info) {
		info.remove();
		info = undefined;
	}
	if(map) {
		map.eachLayer(function(layer){
			layer.remove();
		});
		map.remove();
		map = undefined;
	}
}

/**
 * ajoutes les points de passage sur la map ordonné et met à jour les infos liées
 * Ne prend pas en compte si la position n'a pas bougé
 * @param coord de type nsIDOMGeoPositionCoords
 * @param longitude position à ajouter
 * @param timestamp date correspondant à la position (facultatif)
 * @return vrai si la position à été sauvegardée
 */
export function newPosition(coord, timestamp) {

	/**
	 * Enregistre la position et met à jour la map
	 */
	function setPosition(latitude, longitude, timestamp) {
		//déplace le marker
		if(mark) {
			mark.setLatLng([latitude, longitude]);
		}

		//Centre la vue
		map.panTo(new L.LatLng(latitude, longitude));

		//Ajoute la position à tableau
		positions.push({latitude: latitude,longitude:longitude,time:timestamp});
	}

	if(timestamp == undefined) {
		timestamp = new Date().getTime();
	}

	var lastPos;
	var distance = 0;

	if(positions.length > 0) {
		lastPos = positions[positions.length - 1];
		distance = Nav.distanceCoord(coord,lastPos);
	}

	if(distance > 0) {
		//Met à jour la distance
		distanceTotale += distance;

		//Trace la distance
		L.polyline([[coord.latitude,coord.longitude],[lastPos.latitude,lastPos.longitude]], {color: 'red'}).addTo(map);
	}
	setPosition(coord.latitude, coord.longitude, timestamp);
}

/**
 * permet de charger sur la carte des points en premier
 */ 
export function loadPositionsFirst(records) {
	var newPositions = [];
	var lastPos;
	var newDistanceTotale = 0;
	
	for(var i = 0 ; i < records.length; i++) {
		var coord = records[i];
		var distance = 0;
		if(newPositions.length > 0) {
			lastPos = newPositions[newPositions.length - 1];
			distance = Nav.distanceCoord(coord,lastPos);
		}
		if(distance > 0) {
			//Met à jour la distance
			newDistanceTotale += distance;
	
			//Trace la distance
			L.polyline([[coord.latitude,coord.longitude],[lastPos.latitude,lastPos.longitude]], {color: 'blue'}).addTo(map);
		}
		newPositions.push(coord);
	}
	Nav.sortRecord(newPositions);

	positions = newPositions.concat(positions);
	distanceTotale += newDistanceTotale;	
}
