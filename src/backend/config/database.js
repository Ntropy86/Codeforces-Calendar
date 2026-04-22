const mongoose = require("mongoose");

const { MONGO_URL } = process.env;

exports.connect = () => {
  if (!MONGO_URL) {
    console.error("[db] MONGO_URL is not set — refusing to start");
    process.exit(1);
  }

  mongoose
    .connect(MONGO_URL)
    .then(() => console.log("[db] connected"))
    .catch((error) => {
      console.error("[db] connection failed — exiting", error);
      process.exit(1);
    });
};
