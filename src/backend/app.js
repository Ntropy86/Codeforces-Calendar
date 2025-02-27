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


//=============================================================

//========================Models Import==========================
const User = new mongoose.model("User", Models.userSchema);
const GlobalProblemSet = new mongoose.model("GlobalProblemSet", Models.globalProblemSetSchema);
const FilteredProblemSet = new mongoose.model("FilteredProblemSet", Models.filteredProblemSetSchema);
//================================================================

//============================Routing============================

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
					res.status(200).json(user);
				}
			})
		}catch(err){
			res.status(500).json(err);
		}
	}
	)
	.post(async (req, res) => {
		try {
			if(req.body.userID === undefined){
				res.status(400).json("UserID is required");
			}
			console.log("User ID:",req.body.userID,req.body)
			await User.find({ UserID: req.body.userID }).then(async (user) => {
				console.log("User Data FROM MONGO:",user);
				if (user.length !== 0) {
					console.log("User already exists",user);
					res.status(403).json("User already exists",user);
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
						res.status(200).json(newUser);
					} catch (err) {
						res.status(500).json(err);
					}
				}
			}
			);
		} catch (err) {
			res.status(500).json(err);
		}
	})

			



//Plan Routes
// app.route("/plans")
// 	.get(async (req, res) => {
// 		try {
// 			await Plan.find({}, async (err, plans) => {
// 				if (!err) {
// 					Plans = [];
// 					plans.map((plan) => {
// 						Plans = [...Plans, plan];
// 					});
// 					res.status(200).json(Plans);
// 				} else {
// 					res.status(500).send(err);
// 				}
// 			})
// 				.clone()
// 				.catch(function (err) {
// 					console.log(err);
// 				});
// 		} catch (err) {
// 			res.status(500).json(err);
// 		}
// 	})
// 	.post(async (req, res) => {
// 		try {
// 			await Plan.find({ name: req.body.name }, async (err, foundPlan) => {
// 				if (foundPlan.length !== 0) {
// 					res.status(403).json(foundPlan);
// 				} else {
// 					const newPlan = new Plan({
// 						name: req.body.name,
// 						weight: req.body.weight,
// 						price: req.body.price,
// 						duration: -1,
// 					});
// 					if (req.body.duration !== undefined) {
// 						console.log("BBBBBBBBBx");
// 						newPlan.duration = req.body.duration;
// 					}

// 					try {
// 						const plan = newPlan.save();
// 						res.status(200).json(newPlan);
// 					} catch (err) {
// 						res.status(500).json(err);
// 					}
// 				}
// 			})
// 				.clone()
// 				.catch(function (err) {
// 					console.log(err);
// 				});
// 		} catch (err) {
// 			res.status(500).json(err);
// 		}
// 	})
// 	.delete(async (req, res) => {
// 		try {
// 			Plan.findOneAndDelete(
// 				{ _id: req.body.id },
// 				async (err, foundPlan) => {
// 					if (!err) {
// 						res.status(200).json(foundPlan);
// 					} else {
// 						res.status(500).json(err);
// 					}
// 				},
// 			);
// 		} catch (err) {
// 			res.status(500).json(err);
// 		}
// 	});
//----------------------------------------------------------------

module.exports = app;
