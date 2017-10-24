const common = require("./common");
const title_regex = /([^-]+)(?:[-]([^\[]+))?(?:[\[]([^\]]+)[\]])?/;

module.exports = {
  get_youtube_info: get_youtube_info
};


function parse_title(title) {
	var match = title.match(title_regex);
	var output = {}
	if(match == null) {
		output["song"] = title.trim();
	} else {
		if(match[2] == undefined) {
			output["song"] = title.trim();
		} else {
			output["artist"] = match[1].trim();
			output["song"] = match[2].trim();
		}
		if(match[3] != undefined) {
			output["album"] = match[3].trim();
		}
	}
	return output;
}

function get_youtube_info(video_id, on_success, on_failure) {
	var yt_url = "https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=" + video_id + "&format=json";
	common.get_data(
		yt_url, 
		function(data) {
			var output = {
				"title": data.title,
				"author_name": data.author_name,
				"video_id": data.video_id,
				"meta": parse_title(data.title) };

			on_success(output)
		},
		function(error) {
			callback(false, error);
		}
	);
}
    	
