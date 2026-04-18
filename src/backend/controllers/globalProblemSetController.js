const globalProblemSetService = require("../services/globalProblemSetService");

const updateGlobalProblemSet = async (_req, res) => {
  try {
    const stats = await globalProblemSetService.updateGlobalProblemSet();
    res.status(200).json({ message: "Problem set update completed", stats });
  } catch (err) {
    console.error("[global] update failed:", err);
    res.status(500).json({ message: err.message || "Internal server error" });
  }
};

module.exports = { updateGlobalProblemSet };
