const express = require('express');
const router = express.Router();
const response = require('../utils/test_validateStreak.json');

router.get('/submissions', (req, res) => {
    res.status(200).json(response);
});

module.exports = router;