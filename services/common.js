const request = require("request");

module.exports = {
  get_data: get_data
};

function get_data(url, on_success, on_error) {
	console.log("get_data: " + url);
	var options = {
  		url: url,
  		headers: {
    		'User-Agent': 'MusicGrabber/0.1.0 (https://github.com/georgemitchell/music_grabber)'
  		}
	};

	request(options, function (error, response, body) {
    	if(response && response.statusCode == 200) {
    		var data = JSON.parse(body);
    		on_success(data);
    	} else {
    		console.error("get_data() failed[" + response + "]: " + error + " {" + body + "} ");
    		on_error(error);
    	}
    });
}
