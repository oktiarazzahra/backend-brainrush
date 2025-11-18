const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  startLearning,
  submitLearning,
  getLearningHistory,
  getLearningResult,
  getLearningStats
} = require('../controllers/learningController');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/start/:quizId', startLearning);
router.post('/submit', submitLearning);
router.get('/history', getLearningHistory);
router.get('/stats', getLearningStats);
router.get('/:scoreId', getLearningResult);

module.exports = router;
