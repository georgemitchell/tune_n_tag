const express = require('express');
const youtube = require("./youtube");
const musicbrainz = require("./musicbrainz");
const cors = require('cors')
const app = express();
const port = 35099;
const request = require("request");
const mongo_utils = require("./mongo_utils");
const mongoose = require('mongoose');

const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017/tunentag';
app.use(cors());

app.get('/', (request, response) => {
	var url = request.query["q"];
	var youtube_info = youtube.get_youtube_info(url, function(success, data) {
		if(success) {
			musicbrainz.find_track(
				data.title, 
				function(resuts) {
					output = results;
					output["success"] = true;
					response.send(output);
				},
				function(error) {
					output = {"success": false, "error": "Unable to retrieve Musicbrainz info (" + error + "), check the logs" };
					response.send(output);
				});
		} else {
			output = {"success": false, "error": "Unable to retrieve YouTube info, check the logs" };
			response.send(output);
		}
	});
})



app.get('/youtube/', (request, response) => {
	var url = request.query["q"];
	youtube.get_youtube_info(
		url,
		function(results) {	
			var output = results;
			output["success"] = true;
			response.send(output);
		},
		function(error) {
			var output = error;
			output["success"] = false;
			response.send(output);
		}
	);
})


app.get('/artist/', (request, response) => {
	var query = request.query["q"];

	// Check if mongodb contains artist
	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			response.send({"success": false, "error": err});
		} else {
			mongo_utils.find_documents(
				db,
				"artists",
				{name: query},
				function(results) {
					if(results.length > 0) {
						output = {
							"success": true,
							"artists": results
						}
						response.send(output);
					} else {
						musicbrainz.query_artist(
							query,
							function(results) {
								mongo_utils.insert_documents(
									db,
									"artists",
									results,
									function(result) {
										var output = {
											"artists": results,
											"db": result,
											"success": true
										}
										response.send(output);
									},
									function(error) {
										var output = {
											"success": false,
											"error": error
										}
										console.error("Error inserting documents");
										response.send(output);
									}
								);
							},
							function(error) {
								var output = {
									"success": false,
									"error": error
								}
								console.error("Error querying musicbrainz");
								response.send(output);
							}
						);
					}
				},
				function(error) {
					var output = {
						"success": false,
						"error": error
					}
					console.error("Error finding documents");
					response.send(output);
				}
			);
		}
	})
})


app.get('/autocomplete/artist', (request, response) => {
	var prefix = request.query["q"];
	var regex = new RegExp(prefix, "i");
	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			response.send({"success": false, "error": err});
		} else {
			mongo_utils.find_documents(
				db,
				"artists",
				{name: regex},
				function(results) {
					var artists = []
					for(var i=0; i<results.length; i++) {
						var record = {
							id: results[i].id,
							name: results[i].name
						}
						if ("country" in results[i]) {
							record["country"] = results[i].country;
						}
						if ("life-span" in results[i]) {
							var life_span = results[i]["life-span"].begin + " - ";
							if (results[i]["life-span"].ended !== null) {
								if (results[i]["life-span"].ended) {
									life_span += results[i]["life-span"].end;
								}
							}
							record["life_span"] = life_span;
						}
						artists.push(record);
					}
					response.send({"success": true, "artists": artists});
				},
				function(error) {
					response.send({"success": false, "error": error})
				}
			);
		}
	});
})

function send_error(db, response, error) {
	var output = {
		"success": false,
		"error": error
	}
	response.send(output);
	if(db !== null) {
		db.close();
	}
}

function get_albums(db, artist, job, progress_callback) {
	musicbrainz.get_artist_albums(
		artist,
		progress_callback,
		function(albums, tracks) {
			mongo_utils.insert_documents(
				db,
				"albums",
				albums,
				function(result) {
					mongo_utils.insert_documents(
						db,
						"tracks",
						tracks,
						function(result) {
							var output = {
								"album_count": albums.length,
								"track_count": tracks.length,
							}
							mongo_utils.job_success(db, job, output);
							db.close();
						},
						function(error) { mongo_utils.job_fail(db, job, error); }
					)
				},
				function(error) { mongo_utils.job_fail(db, job, error); }
			);
		},
		function(error) { mongo_utils.job_fail(db, job, error); }
	);
}

app.get('/albums/', (request, response) => {
	var artist_id = request.query["a"];
	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			send_error(response, err);
		} else {
			mongo_utils.find_documents(
				db,
				"artists",
				{id: artist_id},
				function(results) {
					var artist = results[0];
					if(results.length == 0) {
						send_error(response, "Unable to locate " + artist_id + " in mongodb");
					} else {
						var job = {
							"type": "albums",
							"artist_id": artist_id,
							"name": `Get ${artist.name}'s albums`
						}
						mongo_utils.create_job(
							db,
							job,
							function(created_job) {
								get_albums(
									db,
									artist,
									created_job,
									function(progress) {
										mongo_utils.update_job_progress(db, created_job, progress, "Getting Albums");
									}
								);
								response.send({"success": true, "job_id": created_job._id})	
								// Don't need to close db, because it will be handled by
								// get_albums
							},
							function(error) { send_error(db, response, error); }
						)			
					}
				},
				function(error) { send_error(db, response, error); }
			);
		}
	});
})


app.get('/autocomplete/album/', (request, response) => {
	var prefix = request.query["q"];
	var regex = new RegExp(prefix, "i");
	var query = {"title": regex};

	if("a" in request.query) {
		query["artist_id"] = request.query["a"];
	}
	
	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			response.send({"success": false, "error": err});
		} else {
			mongo_utils.find_documents(
				db,
				"albums",
				query,
				function(albums) {
					response.send({"success": true, "albums": albums});
				},
				function(error) {
					response.send({"success": false, "error": error})
				}
			);
		}
	});

})


app.get('/autocomplete/track/', (request, response) => {
	var prefix = request.query["q"];
	var regex = new RegExp(prefix, "i");

	var query = {"title": regex};

	if("a" in request.query) {
		query["artist_id"] = request.query["a"];
	}

	if("r" in request.query) {
		query["album_id"] = request.query["r"];
	}
	
	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			response.send({"success": false, "error": err});
		} else {
			mongo_utils.find_documents(
				db,
				"tracks",
				query,
				function(results) {
					var tracks = []
					for(var i=0; i<results.length; i++) {
						var record = {
							id: results[i].id,
							title: results[i].title,
							artist: results[i].album.artist,
							album: results[i].album.title,
							format: results[i].album.format,
							country: results[i].album.country,
							year: results[i].album.year,
							status: results[i].album.status,
							num_tracks: results[i].album.num_tracks,
							track_number: results[i].track_number
						}
						tracks.push(record);
					}
					response.send({"success": true, "tracks": tracks});
					db.close();
				},
				function(error) {
					response.send({"success": false, "error": error});
					db.close();
				}
			);
		}
	});

})


app.get('/track/', (request, response) => {
	var query = request.query["q"];
	musicbrainz.query_song(
		query,
		function(songs) {
			var tracks = [];
			songs.map(function(song) {
				var albums = []
				song["releases"].map(function (release) {
					albums.push({"title": release.title})
				});
				var track = {
					title: song.title,
					artist: song["artist-credit"][0].artist.name,
					albums: albums
				}
				tracks.push(track);
			});
			response.send({"success": true, "tracks": tracks})
		},
		function(error) {
			send_error(null, response, error);
		}
	);
})

app.get('/tunentag/', (request, response) => {
	var video_id = request.query["youtube_id"];
	var artist = request.query["artist"];
	var album = request.query["album"];
	var song = request.query["song"];
	var year = request.query["year"];
	var track_number = request.query["track_number"];
	var total_tracks = request.query["num_tracks"];

	console.log(request.query);

	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			send_error(db, response, err);
		} else {
			mongo_utils.find_documents(
				db,
				"tagged",
				{"youtube_id": video_id},
				function(results) {
					if(results.length > 0) {
						send_error(response, video_id + " already downloaded!");
					} else {
						var job = {
							"type": "tunentag",
							"youtube_id": video_id,
							"name": "Download and tag " + video_id,
							"status": []
						}
						mongo_utils.create_job(
							db,
							job,
							function(created_job) {
								const { spawn } = require('child_process');
								var parameters = [
									'tunentag.sh',
									`${video_id}`,
									`${artist}`,
									`${album}`,
									`${song}`,
									year,
									track_number,
									total_tracks,
									created_job._id
								];
								const tunentag = spawn('bash', parameters);

								tunentag.stdout.on('data', (data) => {
									console.log(`tunentag: ${data}`);
								});

								tunentag.stderr.on('data', (data) => {
									console.error(`tunentag (error): ${data}`);
								});

								tunentag.on('close', (code) => {
								  	console.log(`child process exited with code ${code}`);
								});

								response.send({"success": true, "job_id": created_job._id});
								db.close();
							},
							function(error) { send_error(db, response, error); }
						);
					}
				},
				function(error) { send_error(db, response, error); }
			);
		}
	});
})

const tag_fields = [
	"youtube_id",
	"artist",
	"album",
	"song",
	"year",
	"track_number",
	"num_tracks",
	"track_id"
];

function parse_filter(query_params) {
	var filter = {};
	var tokens = query_params["filters"].split(",");
	for(var i=0; i<tokens.length; i++) {
		filter[tokens[i]] = query_params[tokens[i]];
	}
	return filter;
}

app.get('/update_tag/', (request, response) => {
	var record = {}
	console.log(request.query);
	for(index in tag_fields) {
		if (tag_fields[index] in request.query) {
			record[tag_fields[index]] = request.query[tag_fields[index]];
		} else {
			console.log("unable to find: " + key);
		}
	}

	var filter = parse_filter(request.query);
	console.log(record);

	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			send_error(db, response, err);
		} else {
			mongo_utils.upsert_document(
				db,
				"tagged",
				filter,
				record,
				function(result) {
					response.send({"success": true, "result": result});
					db.close();
				},
				function(error) { send_error(db, response, error); }
			);
		}
	});
})

app.get('/job/', (request, response) => {
	var id = mongoose.Types.ObjectId(request.query["i"]);
	MongoClient.connect(mongo_url, function(err, db) {
		if(err !== null) {
			response.send({"success": false, "error": err});
		} else {
			mongo_utils.find_document(
				db,
				"jobs",
				{_id: id},
				function(job) {
					response.send({"success": true, "job": job});
				},
				function(error) {
					response.send({"success": false, "error": error})
				}
			);
		}
		db.close();
	});
})


app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});


app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }

  console.log(`server is listening on ${port}`)
})
