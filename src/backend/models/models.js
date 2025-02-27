const mongoose = require("mongoose");


exports.globalProblemSetSchema = new mongoose.Schema({
	problemID: String,
	problemRating: Number,
	problemURL: String,
	problemUsed:Boolean
});

exports.filteredProblemSetSchema = new mongoose.Schema({
    // "problems" is a Map with dynamic rating keys.
    // Each rating key maps to an array of problem objects.
    problems: {
        type: Map,
        of: [
            new mongoose.Schema(
                {
                    day: {
                        type: Number,
                        required: true,
                    },
                    // Add additional fields for your problem details as needed.
                    problemID: String,
                    problemURL: String,
                },
                { _id: false }
            ),
        ],
    },
});


//User Schema
exports.userSchema = new mongoose.Schema({
	
    userID:String,
	rating:Number,
	streak : {
		last_streak_date : Date,
		last_streak_count : Number
	}
});
