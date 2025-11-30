const express = require('express');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const {
  createLiveGame,
  joinGame,
  getGame,
  startGame,
  submitAnswer,
  saveAnswer,
  nextQuestion,
  endGame,
  getGameResults,
  getUserGameHistory
} = require('../controllers/gameController');

const router = express.Router();

// Routes accessible to both guest and logged-in users
router.post('/join', optionalAuth, joinGame);
router.get('/:id', optionalAuth, getGame);
router.post('/:id/save-answer', optionalAuth, saveAnswer);
router.post('/:id/answer', optionalAuth, submitAnswer);

// All other routes are protected (require authentication)
router.use(protect);

router.post('/', createLiveGame);
router.get('/history/user', getUserGameHistory);
router.post('/:id/start', startGame);
router.post('/:id/next-question', nextQuestion);
router.post('/:id/end', endGame);
router.get('/:id/results', getGameResults);

module.exports = router;
