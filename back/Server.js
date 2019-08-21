/*
 * Serveur safe trip
 *
 */
var https = require('https');
var fs = require('fs');
var log4js = require('log4js');
var NoSQL = require('nosql');
var random = require('randomstring');

var privateKey = fs.readFileSync('./certs/privkey.pem');
var certificate = fs.readFileSync('./certs/cert.pem');
var port = 8081;
//base de données contenant la liste des tracks
var db_tracks = NoSQL.load('tracks.nosql');
//base de données contenant chaque enregistrement
var db_records = NoSQL.load('records.nosql');

//contrôle des ips de provenance pour limiter les accès
var acces_ips = [];
//URL du domaine de base
var origin = "https://******.fr";
//Taille par défaut de l'id (64 max)
var idLength = 5;

var ROUTES = {
	// GET /tracks => retourne l'ensemble des tracks public (limité au 20 derniers) avec leur id
	GET_TRACKS : /^GET \/tracks$/,
	// GET /newTrack => Retourne l'ID d'une nouvelle track en mode création et un CODE interne de modification
	GET_NEW_TRACK : /^GET \/newTrack\/([0-9]+)$/,
	// GET /track/ID => Retourne l'ensemble des infos concernant une track
	GET_TRACK : /^GET \/track\/([A-Za-z0-9]+)$/,
	// POST /track => met à jour avec le nom la track
	POST_TRACK : /^POST \/track$/,
	// GET /records/ID_TRACK/ts => retourne l'ensemble des modifications de la track depuis le timestamp ts
	GET_RECORDS : /^GET \/records\/([A-Za-z0-9]+)\/([0-9]+)$/,
 	// POST /records/ID_TRACK/CODE_MODIF => Ajoute les nouvelles routes depuis la dernière maj
	POST_RECORDS : /^POST \/records\/([A-Za-z0-9]+)\/([A-Za-z0-9]+)$/
}

var options = {
  key: privateKey,
  cert: certificate
};
log4js.configure({
	appenders: { server: {type: 'file', filename: 'server.log'} },
	categories: {default: {appenders: ['server'], level: 'debug' } }
});
var logger = log4js.getLogger('server');

logger.info('###### Initialisation du serveur #####');
logger.info('###### Port : ',port);
logger.info('###### Origin : ', origin);

/* Router */
function routeRequest(request, response, data, success) {
	var url = request.url;
	var method = request.method;
	var route = method + ' ' + url;
	logger.debug('[ROUTE] request ',method, url, data);

	if(route.match(ROUTES.GET_TRACKS)) {
		//liste des tracks public
		db_tracks.find().make(function(builder){
			builder.where('public',true);
			builder.fields('id','name','date_creation');
			builder.sort('date_creation','desc');
			builder.callback(function(err,resp) {
				logger.debug('[RESP] ', resp);
				success(200,{tracks:resp});
			});
		});
	} else if(route.match(ROUTES.GET_NEW_TRACK)) {
		var param = ROUTES.GET_NEW_TRACK.exec(route);
		var ts = param[1];
		var serverTS = new Date().getTime();
		//décalage de date entre le serveur et le client
		var decalTS = serverTS - ts;
		logger.debug('[NEW_TRACK] ts, decal ',ts,decalTS);
		var newTrack = {
			id: random.generate(idLength),
			public: false,
			date_creation: new Date().getTime(),
			name: '',
			editkey:random.generate(8),
			decalTS: decalTS
		}
		db_tracks.insert(newTrack).callback(function(err) {
			success(200,newTrack);
		});
	} else if(route.match(ROUTES.GET_TRACK)) {
		//recupère l'ensemble d'un parcours
		var param = ROUTES.GET_TRACK.exec(route);
		var id = param[1];
		db_tracks.find().make(function(btrack){
			btrack.where('id', String(id));
			btrack.fields('id','name','date_creation');
			btrack.first();
			btrack.callback(function(errt,respt) {
				if(respt) {
					db_records.find().make(function(brecords){ 
						brecords.where('id',String(id));
						brecords.sort('time','asc');
						brecords.fields('time','latitude','longitude');
						brecords.callback(function(errr,respr) {
							respt.records = respr;
							logger.debug('[GET_TRACK] ', respt);
							success(200,{respt});
						});
					});
				} else {
					logger.debug('[GET_TRACK] track not found');
					success(200,{error: 'track not found'});
				}
			});
		});

	} else if(route.match(ROUTES.POST_TRACK)) {
		if(data) {
			//Cherche l'élément par son id avec le code d'édition
			db_tracks.find().make(function(btrack){
				btrack.where('id', String(data.id));
				btrack.where('editkey', String(data.editkey));
				btrack.first();
				btrack.callback(function(errt,respt) {
					if(respt) {
						logger.debug('[POST_TRACK] success find');
						//Met à jour l'élément
						respt.name = data.name;
						respt.public = data.public;
						db_tracks.update(respt).make(function(upbuil) {
							upbuil.where('id', String(data.id));
							upbuil.where('editkey', String(data.editkey));
							upbuil.callback(function(err, count) {
								logger.debug('[POST_TRACK] success update');
								success(201,respt);
							});
						});
					}
				});
			});
		}
	} else if(route.match(ROUTES.GET_RECORDS)) {
		//recupère l'ensemble d'un parcours
		var param = ROUTES.GET_RECORDS.exec(route);
		var id = param[1];
		var ts = param[2];
		logger.debug('get record for ',id,ts);
		
		db_records.find().make(function(brecords){ 
			brecords.where('id',String(id));
			brecords.where('time', '>', Number(ts));
			brecords.sort('time','asc');
			brecords.fields('id','time','latitude','longitude');
			brecords.callback(function(errr,respr) {
				logger.debug('[GET_RECORDS] ', respr);
				success(200,{records : respr});
			});
		});
	} else if(route.match(ROUTES.POST_RECORDS)) {
		//enregistre l'ensemble des records pour un track
		var param = ROUTES.POST_RECORDS.exec(route);
		var id = param[1];
		var editkey = param[2];
		
		if(data) {
			//Cherche l'élément par son id avec le code d'édition
			db_tracks.find().make(function(btrack){
				btrack.where('id', String(id));
				btrack.where('editkey', String(editkey));
				btrack.first();
				btrack.callback(function(errt,respt) {
					if(respt) {
						logger.debug('[POST_RECORDS] track :', respt);
						//Autorisé à ajouter des records
						data.records.forEach(function(record) {
							var newRecord = {id:id, time:record.time + respt.decalTS, latitude:record.latitude, longitude:record.longitude}
							db_records.insert(newRecord).callback(function(err) {
								logger.debug('[POST_RECORDS] insert record :', newRecord);
							});
						});
						success(201,data);
					} else {
						logger.debug('[POST_RECORDS] erreur acces');
						success(403,{});
					}
				});
			});
		} else {
			logger.debug('[POST_RECORDS] erreur pas de donnée');
			success(404,{});
		}
	} else {
		success(404,{});	
	}
}

https.createServer(options,function (request, response) {
	var ip = request.connection.remoteAddress;
	logger.info("[ACCES] receive request from ", request.method, request.connection.remoteAddress, request.url);
	var now = new Date().getTime();
	var lastAcces = 0;
	if(acces_ips[ip]) {
		lastAcces = acces_ips[ip];
	}
	acces_ips[ip] = now;
	logger.debug('[ACCES] time since last acces : ',now - lastAcces);

	if(now - lastAcces < 100) {
		logger.info('[ACCES] block ' + ip + ' : last acces to recent.');
		response.end('');
	} else {
		var body = "";
		request.addListener('data', function (chunk) { 
			body += chunk
		});
		request.addListener('end', function () {
			var jsonBody = {};
			if(body != '') {
				jsonBody = JSON.parse(body);
			}

			routeRequest(request, response, jsonBody, function(status, data) {
				response.setHeader('Access-Control-Allow-Origin', origin);
				response.setHeader('Content-Type','application/json');
		        response.writeHead(status, request.headers);
		        response.end(JSON.stringify(data));
			});
		});
	}
}).listen(port);

