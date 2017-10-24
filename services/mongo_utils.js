module.exports = {
  find_document: find_document,
  find_documents: find_documents,
  insert_documents: insert_documents,
  create_job: create_job,
  job_success: job_success,
  job_fail: job_fail,
  update_job_progress: update_job_progress
};

function find_document(db, collection_name, query, on_success, on_failure) {
  var collection = db.collection(collection_name);
  // Find some documents
  collection.findOne(query, function(err, doc) {
  	if(err !== null) {
  		console.error("Problem accessing mongodb");
  		on_failure(err);
  	} else {
  		on_success(doc);
  	}
  });      
}

function find_documents(db, collection_name, query, on_success, on_failure) {
  var collection = db.collection(collection_name);
  // Find some documents

  collection.find(query).toArray(function(err, docs) {
  	if(err !== null) {
  		console.error("Problem accessing mongodb");
  		on_failure(err);
  	} else {
  		on_success(docs);
  	}
  });      
}

function insert_documents(db, collection_name, documents, on_success, on_failure) {
  var collection = db.collection(collection_name);
  
  upsert_loop(db, collection_name, documents, 0, [], on_success, on_failure);
}

function upsert_document(db, collection_name, document, on_success, on_failure) {
	var collection = db.collection(collection_name);
	find_documents(
		db,
		collection_name,
		{_id: document.id},
		function(results) {
	   		if(results.length == 0) {
	   	  		// this is new
	   	  		console.log("Insert new: " + document.id);
	   	  		collection.insertOne(
	   	  			document,
	   	  			function(err, result) {
	   	  				if(err !== null) {
				  			on_failure(err);
				  		} else if((result.result.n !== 1) || (result.ops.length !== 1)) {
				  			on_failure("Error adding " + collection_name + " record");
				  		} else {
				  			on_success(result);
				  		}	
	   	  			}
	   	  		);
	   	  	} else {
	   	  		console.log("Update: " + document.id);
	   	  		collection.replaceOne(
	   	  			{_id: document.id },
	   	  			document,
	   	  			function(err, result) {
	   	  				if(err !== null) {
				  			on_failure(err);
				  		} else if((result.result.n !== 1) || (result.ops.length !== 1)) {
				  			on_failure("Error updating " + collection_name + " record (" + document.id + ")");
				  		} else {
				  			on_success(result);
				  		}	
	   	  			}
	   	  		);
	   	  	}
	   }
	);
}

function upsert_loop(db, collection_name, documents, index, db_results, on_success, on_failure) {
	if(index == documents.length) {
		on_success(db_results);
	} else {
		upsert_document(
			db,
			collection_name,
			documents[index],
			function(result) {
				db_results.push(result);
				upsert_loop(db, collection_name, documents, index+1, db_results, on_success, on_failure);
			},
			on_failure
		);
	}
}

function create_job(db, job, on_success, on_failure) {
	job["time_started"] = Date.now();
	job["progress"] = 0;
	var collection = db.collection("jobs");
	collection.insertOne(
		job,
		function(err, result) {
			if(err !== null) {
	  			on_failure(err);
	  		} else if((result.result.n !== 1) || (result.ops.length !== 1)) {
	  			on_failure("Error adding " + collection_name + " record");
	  		} else {
	  			job["_id"] = result.insertedId;
	  			on_success(job);
	  		}	
		}
	);
}

function job_success(db, job, update) {
	var filter = {_id: job._id}
	update["time_ended"] = Date.now();
	update["success"] = true;
	update["progress"] = 100;
	var collection = db.collection("jobs");
	collection.updateOne(filter, {$set:update});
}

function job_fail(db, job, error) {
	var filter = {_id: job._id}
	update["time_ended"] = Date.now();
	update["error"] = error
	update["success"] = false;
	var collection = db.collection("jobs");
	collection.updateOne(filter, update);
	db.close();
}

function update_job_progress(db, job, progress) {
	var filter = {_id: job._id}
	var update = {"progress": progress};
	var collection = db.collection("jobs");
	collection.updateOne(filter, {$set:update});
}