/**
 * Format
 * expose les différentes méthodes de formatage des données
 * 
 */

 /*
  * Format la vitesse en fonction du paramétrage choisit
  * @param vitesse en m/s
  */ 
 export function formatVitesse(vitesse) {
	var vitesseKm = 3.6 * vitesse;
	return Math.round(vitesseKm)+' km/h';
 }

/*
 * Format une durée en h min seconde
 * @param duree temps en milliseconde
 */ 
 export function formatDuree(duree) {
	var dS = Math.round(duree/1000);
	var formatS = dS % 60;
	var dM = ((dS - formatS) / 60);
	var formatM = dM % 60;
	var formatH = (dM - formatM) / 60;

	//format #h ##min ou ##min ##s
	var result = '';
	if(formatH > 0) {
		result += formatH + 'h ';
	}
	if(formatM > 0) {
		result += formatM + 'min ';
	}
	if(formatH == 0) {
		result += formatS +'s';
	}
	return result;
 }

/**
 * Format une distance 
 * @param {*} distance en mêtre
 */
 export function formatDistance(distance) {
	var result = '';
	var formatM = Math.round(distance) % 1000;
	var formatKm = (Math.round(distance) - formatM) / 1000;
	if(formatKm > 0) {
		result += formatKm + 'km ';
	}

	result += formatM + 'm';
	
	return result;
 }