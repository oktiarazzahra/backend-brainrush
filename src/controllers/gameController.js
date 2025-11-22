const LiveGame = require('../models/LiveGame');
const GameHistory = require('../models/GameHistory');
const Quiz = require('../models/Quiz');
const generatePIN = require('../utils/generatePIN');

// @route   POST /api/games
// @desc    Create live game (generate PIN)
// @access  Private
exports.createLiveGame = async (req, res, next) => {
  try {
    const { quizId } = req.body;

    if (!quizId) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide quiz ID'
      });
    }

    const quiz = await Quiz.findById(quizId)
      .populate('questions');

    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        message: 'Quiz not found'
      });
    }

    // Check if host owns the quiz
    if (quiz.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to host this quiz'
      });
    }

    const liveGame = await LiveGame.create({
      quiz: quizId,
      host: req.userId,
      PIN: generatePIN(),
      players: [],
      currentQuestion: 0,
      gameStatus: 'waiting'
    });

    res.status(201).json({
      status: 'success',
      message: 'Live game created successfully',
      data: {
        game: {
          id: liveGame._id,
          PIN: liveGame.PIN,
          quizTitle: quiz.title,
          totalQuestions: quiz.questions.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/games/join
// @desc    Join live game with PIN
// @access  Private
exports.joinGame = async (req, res, next) => {
  try {
    const { PIN, playerName, avatar } = req.body;

    if (!PIN || !playerName) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide PIN and player name'
      });
    }

    const liveGame = await LiveGame.findOne({ PIN })
      .populate('quiz');

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    // Check if game already started - code expired
    if (liveGame.gameStatus === 'running') {
      return res.status(400).json({
        status: 'error',
        message: 'Kode sudah kadaluarsa. Game telah dimulai.'
      });
    }

    // Check if game is ended
    if (liveGame.gameStatus === 'ended') {
      return res.status(400).json({
        status: 'error',
        message: 'Game sudah berakhir'
      });
    }

    // Only allow joining if game is waiting
    if (liveGame.gameStatus !== 'waiting') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot join this game'
      });
    }

    // Check if player already joined
    const alreadyJoined = liveGame.players.some(p => p.userId?.toString() === req.userId);
    if (alreadyJoined) {
      return res.status(400).json({
        status: 'error',
        message: 'You already joined this game'
      });
    }

    // Check max players
    if (liveGame.players.length >= liveGame.maxPlayers) {
      return res.status(400).json({
        status: 'error',
        message: 'Game is full'
      });
    }

    liveGame.players.push({
      userId: req.userId,
      playerName,
      avatar,
      score: 0,
      joinedAt: new Date()
    });

    await liveGame.save();

    res.status(200).json({
      status: 'success',
      message: 'Joined game successfully',
      data: {
        game: {
          id: liveGame._id,
          PIN: liveGame.PIN,
          totalPlayers: liveGame.players.length,
          gameStatus: liveGame.gameStatus
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/games/:id
// @desc    Get live game details
// @access  Private
exports.getGame = async (req, res, next) => {
  try {
    const liveGame = await LiveGame.findById(req.params.id)
      .populate('quiz')
      .populate('players.userId', 'name avatar');

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { game: liveGame }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/games/:id/start
// @desc    Start the game (host only)
// @access  Private
exports.startGame = async (req, res, next) => {
  try {
    const liveGame = await LiveGame.findById(req.params.id);

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    // Check if user is host
    if (liveGame.host.toString() !== req.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to start this game'
      });
    }

    if (liveGame.gameStatus !== 'waiting') {
      return res.status(400).json({
        status: 'error',
        message: 'Game already started'
      });
    }

    liveGame.gameStatus = 'running';
    liveGame.startedAt = new Date();
    await liveGame.save();

    res.status(200).json({
      status: 'success',
      message: 'Game started',
      data: { game: liveGame }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/games/:id/answer
// @desc    Submit answer to question
// @access  Private
exports.submitAnswer = async (req, res, next) => {
  try {
    const { questionId, answer } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide question ID and answer'
      });
    }

    const liveGame = await LiveGame.findById(req.params.id)
      .populate('quiz');

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    // Find player
    const playerIndex = liveGame.players.findIndex(p => 
      p.userId?.toString() === req.userId
    );

    if (playerIndex === -1) {
      return res.status(400).json({
        status: 'error',
        message: 'You are not in this game'
      });
    }

    // Get question from quiz
    const question = liveGame.quiz.questions.find(q => 
      q._id.toString() === questionId
    );

    if (!question) {
      return res.status(404).json({
        status: 'error',
        message: 'Question not found'
      });
    }

    // Check if answer is correct
    const isCorrect = question.correctAnswer === answer;

    // Update score if correct
    if (isCorrect) {
      liveGame.players[playerIndex].score += question.points;
    }

    await liveGame.save();

    res.status(200).json({
      status: 'success',
      message: 'Answer submitted',
      data: {
        isCorrect,
        points: isCorrect ? question.points : 0,
        currentScore: liveGame.players[playerIndex].score
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/games/:id/next-question
// @desc    Move to next question (host only)
// @access  Private
exports.nextQuestion = async (req, res, next) => {
  try {
    const liveGame = await LiveGame.findById(req.params.id)
      .populate('quiz');

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    // Check if user is host
    if (liveGame.host.toString() !== req.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized'
      });
    }

    const totalQuestions = liveGame.quiz.questions.length;

    if (liveGame.currentQuestion >= totalQuestions - 1) {
      // Game finished
      liveGame.gameStatus = 'ended';
      liveGame.endedAt = new Date();

      // Sort players by score (rank)
      const rankedPlayers = [...liveGame.players]
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
          userId: player.userId,
          playerName: player.playerName,
          avatar: player.avatar,
          score: player.score,
          totalPoints: player.score,
          rank: index + 1,
          answers: player.answers || []
        }));

      // Save to GameHistory
      const gameHistory = await GameHistory.create({
        hostId: liveGame.host,
        quizId: liveGame.quiz._id,
        PIN: liveGame.PIN,
        playerResults: rankedPlayers,
        totalPlayers: liveGame.players.length,
        startedAt: liveGame.startedAt,
        endedAt: liveGame.endedAt
      });

      await liveGame.save();

      return res.status(200).json({
        status: 'success',
        message: 'Game finished',
        data: {
          gameEnded: true,
          results: rankedPlayers,
          gameHistoryId: gameHistory._id
        }
      });
    }

    liveGame.currentQuestion += 1;
    await liveGame.save();

    res.status(200).json({
      status: 'success',
      message: 'Moving to next question',
      data: {
        currentQuestion: liveGame.currentQuestion,
        totalQuestions
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/games/:id/end
// @desc    End the game immediately (host only)
// @access  Private
exports.endGame = async (req, res, next) => {
  try {
    const liveGame = await LiveGame.findById(req.params.id);

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    // Check if user is host
    if (liveGame.host.toString() !== req.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized'
      });
    }

    liveGame.gameStatus = 'ended';
    liveGame.endedAt = new Date();

    // Rank players
    const rankedPlayers = [...liveGame.players]
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        userId: player.userId,
        playerName: player.playerName,
        avatar: player.avatar,
        score: player.score,
        totalPoints: player.score,
        rank: index + 1,
        answers: player.answers || []
      }));

    // Save to GameHistory
    const gameHistory = await GameHistory.create({
      hostId: liveGame.host,
      quizId: liveGame.quiz,
      PIN: liveGame.PIN,
      playerResults: rankedPlayers,
      totalPlayers: liveGame.players.length,
      startedAt: liveGame.startedAt,
      endedAt: liveGame.endedAt
    });

    await liveGame.save();

    res.status(200).json({
      status: 'success',
      message: 'Game ended',
      data: {
        results: rankedPlayers,
        gameHistoryId: gameHistory._id
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/games/:id/results
// @desc    Get game results (after game ends)
// @access  Private
exports.getGameResults = async (req, res, next) => {
  try {
    const gameHistory = await GameHistory.findById(req.params.id)
      .populate('hostId', 'name')
      .populate('quizId', 'title');

    if (!gameHistory) {
      return res.status(404).json({
        status: 'error',
        message: 'Game results not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { results: gameHistory }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/games/history/user
// @desc    Get user's game history (as player or host)
// @access  Private
exports.getUserGameHistory = async (req, res, next) => {
  try {
    // Find games where user was a player
    const playerGames = await GameHistory.find({
      'playerResults.userId': req.userId
    })
      .populate('quizId', 'title category coverImage')
      .populate('hostId', 'name')
      .sort({ completedAt: -1 });

    // Find games where user was host
    const hostGames = await GameHistory.find({
      hostId: req.userId
    })
      .populate('quizId', 'title category coverImage')
      .sort({ completedAt: -1 });

    // Process player games to include user's rank and score
    const playerHistory = playerGames.map(game => {
      const userResult = game.playerResults.find(
        p => p.userId?.toString() === req.userId
      );

      return {
        id: game._id,
        quizTitle: game.quizId?.title || 'Unknown Quiz',
        category: game.quizId?.category || 'General',
        coverImage: game.quizId?.coverImage,
        date: game.completedAt,
        players: game.totalPlayers,
        yourRank: userResult?.rank || 0,
        yourScore: userResult?.score || 0,
        topScore: game.playerResults[0]?.score || 0,
        avgScore: Math.round(
          game.playerResults.reduce((sum, p) => sum + (p.score || 0), 0) / game.playerResults.length
        ),
        duration: game.endedAt && game.startedAt 
          ? Math.round((new Date(game.endedAt) - new Date(game.startedAt)) / 60000) + ' menit'
          : 'N/A',
        PIN: game.PIN,
        role: 'player'
      };
    });

    // Process host games
    const hostHistory = hostGames.map(game => {
      return {
        id: game._id,
        quizTitle: game.quizId?.title || 'Unknown Quiz',
        category: game.quizId?.category || 'General',
        coverImage: game.quizId?.coverImage,
        date: game.completedAt,
        players: game.totalPlayers,
        topScore: game.playerResults[0]?.score || 0,
        avgScore: Math.round(
          game.playerResults.reduce((sum, p) => sum + (p.score || 0), 0) / game.playerResults.length
        ),
        duration: game.endedAt && game.startedAt 
          ? Math.round((new Date(game.endedAt) - new Date(game.startedAt)) / 60000) + ' menit'
          : 'N/A',
        PIN: game.PIN,
        role: 'host'
      };
    });

    // Combine and sort by date
    const allHistory = [...playerHistory, ...hostHistory]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      status: 'success',
      data: {
        history: allHistory,
        totalGames: allHistory.length,
        playerGames: playerHistory.length,
        hostGames: hostHistory.length
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
