const mongoose = require("mongoose");


exports.globalProblemSetSchema = new mongoose.Schema({
	problemID: String,
	problemRating: Number,
	problemURL: String,
	problemUsed:Boolean
});

exports.filteredProblemSetSchema = new mongoose.Schema({
    // Add month and year to keep track of the period
    month: {
        type: Number,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
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
		last_streak_count : Number, //LEGACY
        streak_days: {
            type: Map,
            of: Boolean,
            default: {}
        }
	}
});