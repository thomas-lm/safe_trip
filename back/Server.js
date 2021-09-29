const { v4: uuidv4 } = require('uuid');
const http = require('http');
const fs = require('fs');
const log4js = require('log4js');
const NoSQL = require('nosql');

var _HttpPort = 80;
var _DbDir = './data/db'
var _TrackDbFile = `${_DbDir}/tracks.nosql`;
var _RecordsDbFile = `${_DbDir}/records.nosql`;
var _LogFile = './data/logs/safetrip.log';

log4js.configure({
	appenders: { server: {type: 'file', filename: _LogFile} },
	categories: {default: {appenders: ['server'], level: 'debug' } }
});
var _Logger = log4js.getLogger('server');

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

_Logger.info(`###### Server initialization on port : ${_HttpPort} #####`);

fs.mkdirSync(_DbDir, {recursive : true});
// Tracks database
if (!fs.existsSync(_TrackDbFile)) {
	_Logger.info(`Creation of file ${_TrackDbFile}`);
	fs.writeFileSync(_TrackDbFile, '{"uid":"", "date":0, "name":"","public":false, "editkey":""}\n');
}
var _DbTracks = NoSQL.load('tracks.nosql');
// Records database
if (!fs.existsSync(_RecordsDbFile)) {
	_Logger.info(`Creation of file ${_RecordsDbFile}`);
	fs.writeFileSync(_RecordsDbFile, '{"uid":"", "time":0,"latitude":0,"longitude":0}\n');
}
var _DbRecords = NoSQL.load('records.nosql');


/* Router */
function routeRequest(request, response, data, success) {
	var url = request.url;
	var method = request.method;
	var route = method + ' ' + url;
	_Logger.debug('[ROUTE] request ',method, url, data);

	if(route.match(ROUTES.GET_TRACKS)) {
		//liste des tracks public
		_DbTracks.find().make(function(builder){
			builder.where('public',true);
			builder.fields('uid','name','date');
			builder.sort('date_creation','desc');
			builder.callback(function(err,resp) {
				_Logger.debug('[RESP] ', resp);
				success(200,{tracks:resp});
			});
		});
	} else if(route.match(ROUTES.GET_NEW_TRACK)) {
		var param = ROUTES.GET_NEW_TRACK.exec(route);
		var ts = param[1];
		var serverTS = new Date().getTime();
		//décalage de date entre le serveur et le client
		var decalTS = serverTS - ts;
		_Logger.debug('[NEW_TRACK] ts, decal ',ts,decalTS);
		var newTrack = {
			uid: uuidv4(),
			public: false,
			date: new Date().getTime(),
			name: '',
			editkey:uuidv4(),
			decalTS: decalTS
		}
		_DbTracks.insert(newTrack).callback(function(err) {
			success(200,newTrack);
		});
	} else if(route.match(ROUTES.GET_TRACK)) {
		//recupère l'ensemble d'un parcours
		var param = ROUTES.GET_TRACK.exec(route);
		var id = param[1];
		_DbTracks.find().make(function(btrack){
			btrack.where('uid', String(id));
			btrack.fields('uid','name','date');
			btrack.first();
			btrack.callback(function(errt,respt) {
				if(respt) {
					_DbRecords.find().make(function(brecords){ 
						brecords.where('uid',String(id));
						brecords.sort('time','asc');
						brecords.fields('time','latitude','longitude');
						brecords.callback(function(errr,respr) {
							respt.records = respr;
							_Logger.debug('[GET_TRACK] ', respt);
							success(200,{respt});
						});
					});
				} else {
					_Logger.debug('[GET_TRACK] track not found');
					success(200,{error: 'track not found'});
				}
			});
		});

	} else if(route.match(ROUTES.POST_TRACK)) {
		if(data) {
			//Cherche l'élément par son id avec le code d'édition
			_DbTracks.find().make(function(btrack){
				btrack.where('uid', String(data.id));
				btrack.where('editkey', String(data.editkey));
				btrack.first();
				btrack.callback(function(errt,respt) {
					if(respt) {
						_Logger.debug('[POST_TRACK] success find');
						//Met à jour l'élément
						respt.name = data.name;
						respt.public = data.public;
						_DbTracks.update(respt).make(function(upbuil) {
							upbuil.where('uid', String(data.id));
							upbuil.where('editkey', String(data.editkey));
							upbuil.callback(function(err, count) {
								_Logger.debug('[POST_TRACK] success update');
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
		_Logger.debug('get record for ',id,ts);
		
		_DbRecords.find().make(function(brecords){ 
			brecords.where('uid',String(id));
			brecords.where('time', '>', Number(ts));
			brecords.sort('time','asc');
			brecords.fields('uid','time','latitude','longitude');
			brecords.callback(function(errr,respr) {
				_Logger.debug('[GET_RECORDS] ', respr);
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
			_DbTracks.find().make(function(btrack){
				btrack.where('uid', String(id));
				btrack.where('editkey', String(editkey));
				btrack.first();
				btrack.callback(function(errt,respt) {
					if(respt) {
						_Logger.debug('[POST_RECORDS] track :', respt);
						//Autorisé à ajouter des records
						data.records.forEach(function(record) {
							var newRecord = {id:uid, time:record.time + respt.decalTS, latitude:record.latitude, longitude:record.longitude}
							_DbRecords.insert(newRecord).callback(function(err) {
								_Logger.debug('[POST_RECORDS] insert record :', newRecord);
							});
						});
						success(201,data);
					} else {
						_Logger.debug('[POST_RECORDS] erreur acces');
						success(403,{});
					}
				});
			});
		} else {
			_Logger.debug('[POST_RECORDS] erreur pas de donnée');
			success(404,{});
		}
	} else {
		success(404,{});	
	}
}

http.createServer({},function (request, response) {
	_Logger.info("[ACCES] receive request from ", request.method, request.connection.remoteAddress, request.connection.remoteAddress, request.url);

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
			response.setHeader('Access-Control-Allow-Origin', "*");
			response.setHeader('Content-Type','application/json');
			response.writeHead(status, request.headers);
			response.end(JSON.stringify(data));
		});
	});
}).listen(_HttpPort);

