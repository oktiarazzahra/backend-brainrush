const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  createLiveGame,
  joinGame,
  getGame,
  startGame,
  submitAnswer,
  nextQuestion,
  endGame,
  getGameResults
} = require('../controllers/gameController');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/', createLiveGame);
router.post('/join', joinGame);
router.get('/:id', getGame);
router.post('/:id/start', startGame);
router.post('/:id/answer', submitAnswer);
router.put('/:id/next-question', nextQuestion);
router.post('/:id/end', endGame);
router.get('/:id/results', getGameResults);

module.exports = router;
