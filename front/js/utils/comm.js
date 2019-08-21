/**
 * Comm
 * expose les différentes méthodes d'accès au serveur
 * 
 */

const urlClient = 'https://nas.le-magourou.fr/safe_trip/mobile/';
const urlServeur = 'https://rs8081-nas.le-magourou.fr/';
const TIME_BETWEEN_REQUEST = 1.1;

/**
 * Envoi une requete asynchrone
 */
function query(method, url, data, success, onError) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4) {
			if(this.status == 200 || this.status == 201) {
				success(JSON.parse(this.responseText));
			} else {
				onError(this.responseText);
			}
		}
	};
	//xhttp.withCredentials = true;
	xhttp.open(method, urlServeur + url, true);
	//xhttp.setRequestHeader("Content-type", "application/json");
	var body = '';
	if(data) {
		body = JSON.stringify(data);
	}
	xhttp.send(body);
}

/**
 * Do get operation on server
 */
export function get(url, success, onError) {
	query('GET', url, undefined, success, function() {
		console.log('erreur get, nouvelle tentative dans 1.5s');
		setTimeout(function(){
				query('GET', url, undefined, success, onError);
			},1500);
		});
}

/**
 * Do post operation on server
 */
export function post(url, data, success, onError) {
	query('POST', url, data, success, function() {
		console.log('erreur post, nouvelle tentative dans 1.5s');
		setTimeout(function(){
			query('POST', url, data, success,onError);
			},1500);
		});
}

/**
 * Retourne l'url du client
 */
export function getUrlClient() {
	return urlClient;
}