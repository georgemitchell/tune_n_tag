const mongo_utils = require("./mongo_utils");
const mongoose = require('mongoose');
const MongoClient = require('mongodb').MongoClient;
const mongo_url = 'mongodb://localhost:27017/tunentag';


if(process.argv.length < 5) {
	console.error("Not enough parameters specified for update_job.js")
	process.exit(3);
}

var job_id = mongoose.Types.ObjectId(process.argv[2]);
var command = {"mode": process.argv[3]}
switch(command.mode) {
	case "success":
		command["extra"] = JSON.parse(process.argv[4]);
		break;

	case "fail":
		command["error"] = process.argv[4];
		break;

	case "update":
		command["percent"] = process.argv[4];
		if (process.argv.length > 5) {
			var message = process.argv[5].trim();
			if(message !== "") {
				command["message"] = message;
			} else {
				command["message"] = null;
			}
			
		} else {
			command["message"] = null;
		}
		break;
}

console.log(command);

MongoClient.connect(mongo_url, function(err, db) {
	var ret_value = 0;
	if(err !== null) {
		console.error(err);
		db.close();
		process.exit(1);
	} else {
		mongo_utils.find_document(
			db,
			"jobs",
			{_id: job_id},
			function(job) {
				switch(command.mode) {
					case "success":
						mongo_utils.job_success(
							db,
							job,
							command.extra,
							function() {
								process.exit(); 
							},
							function(error) {
								console.error(error);
								process.exit(7);
							}
						);
						break;

					case "fail":
						mongo_utils.job_fail(
							db,
							job,
							command.error,
							function() {
								process.exit(); 
							},
							function(error) {
								console.error(error);
								process.exit(4);
							}
						);
						break;

					case "update":
						mongo_utils.update_job_progress(
							db,
							job,
							command.percent, 
							command.message,
							function() { 
								db.close();
								process.exit(); 
							},
							function(error) {
								console.error(error);
								db.close();
								process.exit(3);
							}
						);
						break;

				}
			},
			function(error) {
				console.error(error);
				db.close();
				process.exit(2);
			}
		);
	}
});

