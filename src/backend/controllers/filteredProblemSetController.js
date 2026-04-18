const filteredProblemSetService = require("../services/filteredProblemSetService");

const generateFilteredProblemSets = async (_req, res) => {
  try {
    const stats = await filteredProblemSetService.generateFilteredProblemSets();
    res.status(200).json({ message: "Filtered problem set updated successfully", stats });
  } catch (err) {
    console.error("[filtered] generation failed:", err);
    res.status(500).json({ message: err.message || "Internal server error" });
  }
};

const getMonthlyProblems = async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month !== undefined ? parseInt(req.query.month, 10) : now.getMonth();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const rating = req.query.rating ? parseInt(req.query.rating, 10) : null;

    const result = await filteredProblemSetService.getMonthlyProblems(month, year, rating);

    if (result.status === "not_found") {
      return res.status(404).json({ message: result.message });
    }
    res.status(200).json({ message: "Monthly problems retrieved successfully", data: result });
  } catch (err) {
    console.error("[filtered] fetch failed:", err);
    res.status(500).json({ message: err.message || "Internal server error" });
  }
};

module.exports = { generateFilteredProblemSets, getMonthlyProblems };
