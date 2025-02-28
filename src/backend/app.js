//================Imports================================
// const app = require("express")();
// const res = require("express/lib/response");
// const mongoose = require("mongoose");
// bp = require("body-parser");
// Models = require("./models/models");
// dotenv = require("dotenv");
// jwt = require("jsonwebtoken")

require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bp = require("body-parser");
const Models = require("./models/models");
const app = express();
const mongoose = require("mongoose");
app.use(express.json());

app.use(bp.json());
app.use(bp.urlencoded({ extended: true }));


const User = new mongoose.model("User", Models.userSchema);
const GlobalProblemSet = new mongoose.model("GlobalProblemSet", Models.globalProblemSetSchema);
const FilteredProblemSet = new mongoose.model("FilteredProblemSet", Models.filteredProblemSetSchema);


app.get("/welcome", (req, res) => {
	res.status(200).send("Welcome 🙌 ");
});

// === User Routes ===

app.route("/users")
	.get(async (req, res) => {
		try{
			await User.find({UserID: req.body.UserID}).then((user) => {
				if(user.length === 0){
					res.status(404).json("User not found");
				}
				else{
					res.status(200).json({"message":user});
				}
			})
		}catch(err){
			res.status(500).json({"message":err});
		}
	}
	)
	.post(async (req, res) => {
		try {
			if(req.body.userID === undefined){
				res.status(400).json("UserID is required");
			}
			console.log("User ID:",req.body.userID,req.body)
			await User.find({ userID: req.body.userID }).then(async (user) => {
				console.log("User Data FROM MONGO:",user);
				if (user.length !== 0) {
					console.log("User already exists",user);
					res.status(403).json({"message":"User already exists",user});
				} else {
					const CF_User_API_URL = `https://codeforces.com/api/user.info?handles=${req.body.userID}`;
					const response = await fetch(CF_User_API_URL);
					const data = await response.json();
					const user = data.result[0];
					const userHandle = user.handle;
					const userRating = user.rating;
					console.log("User Data Fetched",user);

					const newUser = new User({
						userID: userHandle,
						rating: userRating,
						streak: {
							last_streak_date:null,
							last_streak_count: 0,
						},
					})
					console.log("New User data",newUser);
					try {
						console.log("New User is being created",newUser);
						const user = await newUser.save();
						console.log("New User is created",newUser);
						res.status(200).json({"message":newUser});
					} catch (err) {
						res.status(500).json({"message":err});
					}
				}
			}
			);
		} catch (err) {
			res.status(500).json({"message":err});
		}
	}
)
	.put(async (req, res) => {
		try {
			const date = new Date();
			const streak_count = parseInt(req.body.last_streak_count) + 1;
			await User.findOneAndUpdate
			(
				{ userID: req.body.userID },
				{ $set: { 
					streak: {
						last_streak_date: date,
						last_streak_count: streak_count,
					},
				} },
				{ new: true },
			).then((user) => {
				console.log("User Streak Updated",user);
				res.status(200).json({"message":user});
			}
			);
		} catch (err) {
			res.status(500).json({"message":err});
		}
	}
	)


// === Problem Routes ===
// Fetch Problems per day

//ONE TIME POPULATION OF PROBLEMS & Updating For new problems OR Updating for rating changes
app.post("/problemset/all", async (req, res) => {
    try {
        // Get count of existing problems in the database
        const existingProblemCount = await GlobalProblemSet.countDocuments({});
        console.log("Existing problems in database:", existingProblemCount);
        
        // Fetch problems from Codeforces API
        const codeforcesAPI = "https://codeforces.com/api/problemset.problems";
        const response = await fetch(codeforcesAPI);
        const data = await response.json();
        
        if (data.status !== "OK") {
            return res.status(400).json({ "message": "Failed to fetch problems from Codeforces API" });
        }
        
        const problems = data.result.problems;
        console.log("Problems fetched from CF API:", problems.length);
        
        // Calculate how many new problems to process
        // Codeforces API returns newest problems first, so we focus on the beginning of the array
        const newProblemsToCheck = Math.max(0, problems.length - existingProblemCount);
        console.log("New problems to check:", newProblemsToCheck);
        
        // Initialize stats for response
        let stats = {
            totalProblems: problems.length,
            existingInDB: existingProblemCount,
            newProblemsChecked: newProblemsToCheck,
            newProblemsAdded: 0,
            duplicatesFound: 0,
			noRatingFound: 0,
            errors: 0
        };
        
        // If there are potentially new problems, process them
        if (newProblemsToCheck > 0) {
            // Get the newest problems to check (from the beginning of the array)
            const newestProblems = problems.slice(0, newProblemsToCheck);
            
            // Create a batch of problems to insert
            const problemsToInsert = [];
            
            // Check each potentially new problem
            for (const problem of newestProblems) {
                try {
                    // Create unique problemID by combining contestId and index
					const problemID = `${problem.contestId}${problem.index}`;
					if(problem.rating === undefined){
						console.log(`Problem rating of ${problemID} is undefined. Skipping this...`);
						stats.noRatingFound++;
						continue;
					}
                    
                    // Check if this problem already exists in the database
                    const existingProblem = await GlobalProblemSet.findOne({ problemID: problemID });
                    
                    if (!existingProblem) {
						console.log(`New problem found: ${problemID}`);
                        const problemURL = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
                        const problemRating = problem.rating || null;
                        
                        // Add to batch insert array
                        problemsToInsert.push({
                            problemID: problemID,
                            problemRating: problemRating,
                            problemURL: problemURL,
                            problemUsed: false
                        });
                    } else {
                        // Problem Either has A Rating Added OR a Rating Change. WARN: NOT A PERFECT FUNCTION AS IT ONLY CHECKS FIRST FEW PROBLEMS
						if((existingProblem.problemRating === undefined && problem.rating !== undefined) || (existingProblem.problemRating !== problem.rating)){
							console.log(`Problem rating of ${problemID} is updated from ${existingProblem.problemRating} to ${problem.rating}`);
							existingProblem.problemRating = problem.rating;
							await existingProblem.save();

						}
						else{
							console.log(`Duplicate problem found: ${problemID}`);
							stats.duplicatesFound++;
						}
                       
                    }
                } catch (error) {
                    console.error(`Error processing problem:`, error);
                    stats.errors++;
                }
            }
            
            // Batch insert new problems if any were found
            if (problemsToInsert.length > 0) {
				
                await GlobalProblemSet.insertMany(problemsToInsert);
                stats.newProblemsAdded = problemsToInsert.length;
				console.log(`Inserting ${stats.newProblemsAdded} into database...`);
            }
        }
        
        res.status(200).json({
            "message": "Problem set update completed",
            stats
        });
        
    } catch (err) {
        console.error("Error in /problemset/all endpoint:", err);
        res.status(500).json({"message": err.message || "Internal server error"});
    }
});
			


module.exports = app;
