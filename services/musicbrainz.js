const request = require("request");
const fuse = require("fuse.js");
const common = require("./common.js");

const MUSICBRAINZ_URL = "http://musicbrainz.org/ws/2/"
const ARTIST_PATH = "artist";
const ALBUM_PATH = "release";
const SONG_PATH = "recording"

module.exports = {
  query_artist: query_artist,
  get_artist_albums: get_artist_albums,
  query_song: query_song
};

function get_top_scores(url, field, on_success, on_error) {
	data = common.get_data(
		url, 
		function(data) {
			var output = [];
			if(data[field].length > 0) {
				var score = parseInt(data[field][0].score);
				for(var i=0; i<data[field].length; i++) {
					if(parseInt(data[field][i].score) >= score) {
						var next = data[field][i];
						next["_id"] = next.id;
						output.push(next);
					} else {
						break;
					}
				}
			}
			on_success(output);
		},
		function(error) {
			on_error(error);
	});
}


function query_artist(query, on_success, on_error) {
	var url = MUSICBRAINZ_URL + ARTIST_PATH + "?fmt=json&query=" + query;
	get_top_scores(url, "artists", on_success, on_error);
}

/*
function get_artist_albums(mbid, on_success, on_error, timeout=1000) {
	var url = MUSICBRAINZ_URL + ALBUM_PATH + "?fmt=json&artist=" + mbid;
	console.log("delay: " + timeout);
	setTimeout(function() { common.get_data(url, function(data) { on_success(data.releases); }, on_error); }, timeout);
	 
}*/


function artist_albums_loop(artist, offset, albums, songs, progress_callback, on_success, on_error) {
	var url = MUSICBRAINZ_URL + ALBUM_PATH + "/?artist=" + artist.id + "&fmt=json&inc=recordings";
	if(offset !== 0) {
		url += "&offset=" + offset;
	}

	common.get_data(
		url,
		function(data) {
			var total = parseInt(data["release-count"]);
			data.releases.map(function(album) {
				var album_record = {
					_id: album.id,
					id: album.id,
					artist_id: artist.id,
					artist: artist.name,
					title: album.title,
					format: album.media[0].format,
					date: album.date,
					status: album.status,
					country: album.country
				};
				album.media[0].tracks.map(function(track) {
					var track_record = {
						_id: track.id,
						id: track.id,
						recording_id: track.recording.id,
						title: track.title,
						album_id: album.id,
						artist_id: artist.id,
						album: album_record
					}
					songs.push(track_record);
				})
				albums.push(album_record);
			});
			if((offset + data.releases.length) < total) {
				offset += data.releases.length;
				var progress = parseInt((offset / total) * 100);
				progress_callback(progress);
				console.log("Pausing 1 second before getting offset: " + offset);
				setTimeout(function() { artist_albums_loop(artist, offset, albums, songs, progress_callback, on_success, on_error) }, 1000);
			} else {
				on_success(albums, songs);
			}
		},
		on_error
	);
}

function get_artist_albums(artist, progress_callback, on_success, on_error) {
	artist_albums_loop(artist, 0, [], [], progress_callback, on_success, on_error);
}

function query_song(song, on_success, on_error) {
	var url = MUSICBRAINZ_URL + SONG_PATH + "?fmt=json&query=" + song;
	get_top_scores(url, "recordings", on_success, on_error);
}


