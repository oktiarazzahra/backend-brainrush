const LiveGame = require('../models/LiveGame');
const GameHistory = require('../models/GameHistory');
const Quiz = require('../models/Quiz');
const generatePIN = require('../utils/generatePIN');

// @route   POST /api/games
// @desc    Create live game (generate PIN)
// @access  Private
exports.createLiveGame = async (req, res, next) => {
  try {
    const { quizId, pinDurationHours = 8 } = req.body;

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

    // Generate PIN and calculate expiry time
    const PIN = generatePIN();
    const pinExpiresAt = new Date();
    pinExpiresAt.setHours(pinExpiresAt.getHours() + pinDurationHours);

    // Create live game
    const liveGame = await LiveGame.create({
      quiz: quizId,
      host: req.userId,
      PIN: PIN,
      pinExpiresAt: pinExpiresAt,
      players: [],
      currentQuestion: 0,
      gameStatus: 'waiting',
      pinDurationHours: pinDurationHours
    });

    // Set quiz to private when PIN is created & update quiz with active PIN info
    // Quiz dengan PIN aktif tidak boleh muncul di daftar public
    quiz.isPublic = false;
    quiz.activePIN = PIN;
    quiz.pinExpiresAt = pinExpiresAt;
    quiz.activeGameId = liveGame._id;
    await quiz.save();

    res.status(201).json({
      status: 'success',
      message: 'Live game created successfully',
      data: {
        game: {
          id: liveGame._id,
          PIN: liveGame.PIN,
          pinExpiresAt: liveGame.pinExpiresAt,
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
// @desc    Join live game with PIN (guest or logged-in user)
// @access  Public (optionalAuth)
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

    // Check if player already joined (for logged-in users only)
    if (req.userId) {
      const alreadyJoined = liveGame.players.some(p => p.userId?.toString() === req.userId);
      if (alreadyJoined) {
        return res.status(400).json({
          status: 'error',
          message: 'You already joined this game'
        });
      }
    }

    // Check max players
    if (liveGame.players.length >= liveGame.maxPlayers) {
      return res.status(400).json({
        status: 'error',
        message: 'Game is full'
      });
    }

    const normalizedNameRaw = typeof playerName === 'string' ? playerName.trim() : '';
    const normalizedName = normalizedNameRaw || 'Player';
    const normalizedAvatar = (() => {
      if (avatar && typeof avatar === 'object') {
        return {
          emoji: avatar.emoji || '👤',
          color: avatar.color || null,
          name: avatar.name || null
        };
      }
      return avatar || '👤';
    })();

    // Guest players (no userId) vs Logged-in players (with userId)
    liveGame.players.push({
      userId: req.userId || null, // null for guest players
      playerName: normalizedName,
      avatar: normalizedAvatar,
      score: 0,
      joinedAt: new Date(),
      answers: [],
      isGuest: !req.userId // Mark if player is guest
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
        },
        player: {
          isGuest: !req.userId
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
      .populate({
        path: 'quiz'
        // Tidak perlu populate 'questions' karena questions adalah embedded subdocuments
        // yang sudah otomatis ter-include dalam quiz document
      })
      .populate('players.userId', 'name avatar');

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    // 🔍 DEBUG: Log quiz timer settings
    if (liveGame.quiz) {
      console.log('🎮 getGame - Quiz Timer Settings:', {
        gameId: req.params.id,
        quizId: liveGame.quiz._id,
        timerMode: liveGame.quiz.timerMode,
        totalTime: liveGame.quiz.totalTime,
        firstQuestionTimeLimit: liveGame.quiz.questions?.[0]?.timeLimit
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
    liveGame.questionStartedAt = new Date();
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

// @route   POST /api/games/:id/submit-answer
// @desc    Submit answer for a question
// @access  Private
exports.submitAnswer = async (req, res, next) => {
  try {
    const { questionId, answer, playerName, timeSpent } = req.body;

    console.log('📥 submitAnswer received:', {
      gameId: req.params.id,
      questionId,
      answer,
      playerName,
      timeSpent,
      answerType: typeof answer,
      isArray: Array.isArray(answer)
    });

    if (!questionId) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide question ID'
      });
    }

    // Allow empty answers (player didn't answer before time ran out)
    // Removed validation: if (answer === undefined || answer === null)

    const liveGame = await LiveGame.findById(req.params.id)
      .populate('quiz');

    if (!liveGame) {
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    const requestedName = typeof playerName === 'string' ? playerName.trim() : null;

    // Find player by user id first (for logged-in users), fallback to player name (for guests)
    let playerIndex = -1;
    
    if (req.userId) {
      // For logged-in users, search by userId
      playerIndex = liveGame.players.findIndex(p => 
        p.userId?.toString() === req.userId
      );
    }
    
    // If not found by userId (guest or userId not matched), search by playerName
    if (playerIndex === -1 && requestedName) {
      playerIndex = liveGame.players.findIndex(p => 
        typeof p.playerName === 'string' && p.playerName.toLowerCase() === requestedName.toLowerCase()
      );
    }

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
    const normalize = (value) => {
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value.trim().toLowerCase();
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim().toLowerCase();
      }
      return value;
    };

    const isArrayAnswer = Array.isArray(answer);
    const normalizedAnswerArray = isArrayAnswer
      ? answer.map(val => normalize(val)).sort()
      : null;
    const normalizedAnswerValue = !isArrayAnswer ? normalize(answer) : null;

    let isCorrect = false;
    const correctAnswer = question.correctAnswer;
    let normalizedCorrectArray = null;

    // Empty answer is always wrong
    const hasNoAnswer = (isArrayAnswer && answer.length === 0) || 
                        (!isArrayAnswer && (answer === '' || answer === null || answer === undefined));
    
    if (hasNoAnswer) {
      isCorrect = false;
    } else if (Array.isArray(correctAnswer)) {
      // Check if correctAnswer is array of indices (numbers) - convert to option text
      const correctIsIndices = correctAnswer.every(val => typeof val === 'number');
      
      if (correctIsIndices && question.options) {
        // Convert indices to option text
        const correctTexts = correctAnswer.map(idx => question.options[idx]).filter(Boolean);
        normalizedCorrectArray = correctTexts.map(val => normalize(val)).sort();
      } else {
        normalizedCorrectArray = correctAnswer.map(val => normalize(val)).sort();
      }

      if (normalizedAnswerArray) {
        isCorrect = normalizedAnswerArray.length === normalizedCorrectArray.length &&
          normalizedAnswerArray.every((val, idx) => val === normalizedCorrectArray[idx]);
      } else if (normalizedAnswerValue !== null && normalizedAnswerValue !== '') {
        isCorrect = normalizedCorrectArray.includes(normalizedAnswerValue);
      }
    } else {
      // Check if correctAnswer is a single index (number) - convert to option text
      if (typeof correctAnswer === 'number' && question.options && question.options[correctAnswer]) {
        isCorrect = normalize(question.options[correctAnswer]) === normalizedAnswerValue;
      } else {
        isCorrect = normalize(correctAnswer) === normalizedAnswerValue;
      }
    }

    // Check accepted answers if available (case insensitive) - only if not empty
    if (!hasNoAnswer && !isCorrect && Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) {
      const normalizedAccepted = question.acceptedAnswers.map(val => normalize(val));
      if (normalizedAnswerArray) {
        const acceptedSet = new Set(normalizedAccepted);
        isCorrect = normalizedAnswerArray.every(val => acceptedSet.has(val)) &&
          (!normalizedCorrectArray || normalizedAnswerArray.length === normalizedCorrectArray.length);
      } else if (normalizedAnswerValue !== null) {
        isCorrect = normalizedAccepted.includes(normalizedAnswerValue);
      }
    }

    // Check if player already answered this question
    if (!Array.isArray(liveGame.players[playerIndex].answers)) {
      liveGame.players[playerIndex].answers = [];
    }

    const existingAnswerIndex = liveGame.players[playerIndex].answers.findIndex(ans => 
      ans.questionId.toString() === questionId
    );

    if (existingAnswerIndex !== -1) {
      const existingAnswer = liveGame.players[playerIndex].answers[existingAnswerIndex];
      
      // If already fully submitted (not just auto-saved), don't update score
      if (existingAnswer.answeredAt && !existingAnswer.autoSaved) {
        return res.status(200).json({
          status: 'success',
          message: 'Answer already submitted',
          data: {
            isCorrect: existingAnswer.isCorrect,
            points: existingAnswer.isCorrect ? (question.points || 1) : 0,
            currentScore: liveGame.players[playerIndex].score,
            timeSpent: existingAnswer.timeSpent,
            alreadyAnswered: true
          }
        });
      }
    }

    // Update score if correct (only on first submission)
    if (isCorrect) {
      liveGame.players[playerIndex].score += (question.points || 1);
    }

    // Record answer history for this player
    const answerTimeSpent = typeof timeSpent === 'number' && timeSpent >= 0 ? timeSpent : null;

    if (existingAnswerIndex !== -1) {
      // Update the auto-saved answer with final submission data
      console.log('✏️ Updating existing answer entry:', {
        oldAnswer: liveGame.players[playerIndex].answers[existingAnswerIndex].answer,
        newAnswer: answer,
        wasAutoSaved: liveGame.players[playerIndex].answers[existingAnswerIndex].autoSaved
      });
      
      liveGame.players[playerIndex].answers[existingAnswerIndex].answer = answer;
      liveGame.players[playerIndex].answers[existingAnswerIndex].isCorrect = isCorrect;
      liveGame.players[playerIndex].answers[existingAnswerIndex].answeredAt = new Date();
      liveGame.players[playerIndex].answers[existingAnswerIndex].timeSpent = answerTimeSpent;
      liveGame.players[playerIndex].answers[existingAnswerIndex].autoSaved = false;
    } else {
      // No auto-save, create new answer entry
      console.log('➕ Creating new answer entry');
      
      liveGame.players[playerIndex].answers.push({
        questionId,
        answer,
        isCorrect,
        answeredAt: new Date(),
        timeSpent: answerTimeSpent,
        autoSaved: false
      });
    }

    // Reset questionStartedAt after final submit so next question can start fresh
    liveGame.players[playerIndex].questionStartedAt = null;
    console.log('⏰ Reset questionStartedAt after final submit');
    
    await liveGame.save();

    console.log('✅ Answer saved successfully:', {
      isCorrect,
      points: isCorrect ? question.points : 0,
      newScore: liveGame.players[playerIndex].score,
      answeredAt: new Date()
    });

    res.status(200).json({
      status: 'success',
      message: 'Answer submitted',
      data: {
        isCorrect,
        points: isCorrect ? question.points : 0,
        currentScore: liveGame.players[playerIndex].score,
        timeSpent: answerTimeSpent
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/games/:id/save-answer
// @desc    Save answer (auto-save without validation/scoring)
// @access  Private
exports.saveAnswer = async (req, res, next) => {
  try {
    const { questionId, answer, playerName } = req.body;

    console.log('💾 saveAnswer (auto-save) received:', {
      gameId: req.params.id,
      questionId,
      answer,
      answerType: typeof answer,
      isArray: Array.isArray(answer),
      playerName
    });

    if (!questionId) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide question ID'
      });
    }

    const liveGame = await LiveGame.findById(req.params.id);

    if (!liveGame) {
      console.log('❌ Game not found:', req.params.id);
      return res.status(404).json({
        status: 'error',
        message: 'Game not found'
      });
    }

    const requestedName = typeof playerName === 'string' ? playerName.trim() : null;

    // Find player by user id first (for logged-in users), fallback to player name (for guests)
    let playerIndex = -1;
    
    if (req.userId) {
      // For logged-in users, search by userId
      playerIndex = liveGame.players.findIndex(p => 
        p.userId?.toString() === req.userId
      );
    }
    
    // If not found by userId (guest or userId not matched), search by playerName
    if (playerIndex === -1 && requestedName) {
      playerIndex = liveGame.players.findIndex(p => 
        typeof p.playerName === 'string' && p.playerName.toLowerCase() === requestedName.toLowerCase()
      );
    }

    if (playerIndex === -1) {
      console.log('❌ Player not found in game:', { userId: req.userId, playerName: requestedName });
      return res.status(400).json({
        status: 'error',
        message: 'You are not in this game'
      });
    }

    console.log('✅ Player found at index:', playerIndex);

    // Initialize answers array if not exists
    if (!Array.isArray(liveGame.players[playerIndex].answers)) {
      liveGame.players[playerIndex].answers = [];
    }

    // Check if answer already exists for this question
    const existingAnswerIndex = liveGame.players[playerIndex].answers.findIndex(ans => 
      ans.questionId.toString() === questionId
    );

    if (existingAnswerIndex !== -1) {
      // Update existing auto-saved answer
      console.log('✏️ Updating auto-saved answer:', {
        oldAnswer: liveGame.players[playerIndex].answers[existingAnswerIndex].answer,
        newAnswer: answer
      });
      
      liveGame.players[playerIndex].answers[existingAnswerIndex].answer = answer;
      liveGame.players[playerIndex].answers[existingAnswerIndex].autoSaved = true;
    } else {
      // Save new answer (without validation, isCorrect will be set on final submit)
      console.log('➕ Creating new auto-saved answer entry');
      
      liveGame.players[playerIndex].answers.push({
        questionId,
        answer,
        autoSaved: true,
        isCorrect: null,
        answeredAt: null,
        timeSpent: null
      });
      
      // Set questionStartedAt for timer restoration on refresh (per-question mode)
      // This marks when player started working on this NEW question
      liveGame.players[playerIndex].questionStartedAt = new Date();
      console.log('⏰ Set questionStartedAt for player (new question) at:', liveGame.players[playerIndex].questionStartedAt);
    }

    await liveGame.save();

    console.log('✅ Auto-save successful');

    res.status(200).json({
      status: 'success',
      message: 'Answer auto-saved',
      data: { saved: true }
    });
  } catch (error) {
    console.error('❌ Error in saveAnswer:', error);
    console.error('Error stack:', error.stack);
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

    // Auto-submit all auto-saved answers for current question before moving to next
    const currentQuestionId = liveGame.quiz.questions[liveGame.currentQuestion]._id;
    console.log('🔄 Auto-submitting answers for question:', currentQuestionId);

    liveGame.players.forEach((player, playerIndex) => {
      if (!Array.isArray(player.answers)) return;

      const answerIndex = player.answers.findIndex(ans => 
        ans.questionId.toString() === currentQuestionId.toString() &&
        ans.autoSaved === true // Only auto-saved, not yet submitted
      );

      if (answerIndex !== -1) {
        const answer = player.answers[answerIndex];
        const question = liveGame.quiz.questions[liveGame.currentQuestion];

        console.log(`⚡ Auto-submitting for ${player.playerName}:`, answer.answer);

        // Validate answer and calculate score
        const normalize = (value) => {
          if (value === undefined || value === null) return '';
          if (typeof value === 'string') return value.trim().toLowerCase();
          if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value).trim().toLowerCase();
          }
          return value;
        };

        const isArrayAnswer = Array.isArray(answer.answer);
        const normalizedAnswerArray = isArrayAnswer
          ? answer.answer.map(val => normalize(val)).sort()
          : null;
        const normalizedAnswerValue = !isArrayAnswer ? normalize(answer.answer) : null;

        let isCorrect = false;
        const correctAnswer = question.correctAnswer;

        // Empty answer is always wrong
        const hasNoAnswer = (isArrayAnswer && answer.answer.length === 0) || 
                            (!isArrayAnswer && (answer.answer === '' || answer.answer === null || answer.answer === undefined));
        
        if (hasNoAnswer) {
          isCorrect = false;
        } else if (Array.isArray(correctAnswer)) {
          const correctIsIndices = correctAnswer.every(val => typeof val === 'number');
          let normalizedCorrectArray;
          
          if (correctIsIndices && question.options) {
            const correctTexts = correctAnswer.map(idx => question.options[idx]).filter(Boolean);
            normalizedCorrectArray = correctTexts.map(val => normalize(val)).sort();
          } else {
            normalizedCorrectArray = correctAnswer.map(val => normalize(val)).sort();
          }

          if (normalizedAnswerArray) {
            isCorrect = normalizedAnswerArray.length === normalizedCorrectArray.length &&
              normalizedAnswerArray.every((val, idx) => val === normalizedCorrectArray[idx]);
          } else if (normalizedAnswerValue !== null && normalizedAnswerValue !== '') {
            isCorrect = normalizedCorrectArray.includes(normalizedAnswerValue);
          }
        } else {
          if (typeof correctAnswer === 'number' && question.options && question.options[correctAnswer]) {
            isCorrect = normalize(question.options[correctAnswer]) === normalizedAnswerValue;
          } else {
            isCorrect = normalize(correctAnswer) === normalizedAnswerValue;
          }
        }

        // Check accepted answers if available
        if (!hasNoAnswer && !isCorrect && Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) {
          const normalizedAccepted = question.acceptedAnswers.map(val => normalize(val));
          if (normalizedAnswerArray) {
            const acceptedSet = new Set(normalizedAccepted);
            isCorrect = normalizedAnswerArray.every(val => acceptedSet.has(val));
          } else if (normalizedAnswerValue !== null) {
            isCorrect = normalizedAccepted.includes(normalizedAnswerValue);
          }
        }

        // Update score if correct
        if (isCorrect) {
          liveGame.players[playerIndex].score += (question.points || 1);
        }

        // Mark as submitted
        liveGame.players[playerIndex].answers[answerIndex].isCorrect = isCorrect;
        liveGame.players[playerIndex].answers[answerIndex].answeredAt = new Date();
        liveGame.players[playerIndex].answers[answerIndex].autoSaved = false;
        liveGame.players[playerIndex].answers[answerIndex].timeSpent = question.timeLimit || 0;

        console.log(`✅ Auto-submitted: ${player.playerName} - ${isCorrect ? 'Correct' : 'Wrong'} - Score: ${liveGame.players[playerIndex].score}`);
      }
    });

    const totalQuestions = liveGame.quiz.questions.length;

    if (liveGame.currentQuestion >= totalQuestions - 1) {
      // Game finished
      liveGame.gameStatus = 'ended';
      liveGame.endedAt = new Date();

      // Sort players by score (rank)
      const rankedPlayers = [...liveGame.players]
        .sort((a, b) => b.score - a.score)
        .map((player, index) => {
          const avatarDisplay = typeof player.avatar === 'object' && player.avatar?.emoji
            ? player.avatar.emoji
            : (player.avatar || '👤');

          // Show ALL questions, not just answered ones
          const answersHistory = liveGame.quiz.questions.map((question) => {
            // Find player's answer for this question (if any)
            const playerAnswer = Array.isArray(player.answers)
              ? player.answers.find(ans => 
                  ans.questionId.toString() === question._id.toString() &&
                  ans.answeredAt && !ans.autoSaved // Only final submissions
                )
              : null;

            // Format user answer
            let userAnswerDisplay = 'No answer';
            if (playerAnswer && playerAnswer.answer !== undefined && playerAnswer.answer !== null && playerAnswer.answer !== '') {
              if (Array.isArray(playerAnswer.answer)) {
                userAnswerDisplay = playerAnswer.answer.length > 0 ? playerAnswer.answer.join(', ') : 'No answer';
              } else {
                userAnswerDisplay = String(playerAnswer.answer);
              }
            }

            // Format correct answer
            let correctAnswerDisplay = 'N/A';
            if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
              const correctAns = question.correctAnswer;
              if (Array.isArray(correctAns)) {
                if (correctAns.every(val => typeof val === 'number') && question.options) {
                  correctAnswerDisplay = correctAns.map(idx => question.options[idx]).filter(Boolean).join(', ');
                } else {
                  correctAnswerDisplay = correctAns.join(', ');
                }
              } else if (typeof correctAns === 'number' && question.options && question.options[correctAns]) {
                correctAnswerDisplay = question.options[correctAns];
              } else {
                correctAnswerDisplay = String(correctAns);
              }
            }

            return {
              questionId: question._id,
              question: question.question || 'Unknown question',
              userAnswer: userAnswerDisplay,
              correctAnswer: correctAnswerDisplay,
              isCorrect: playerAnswer ? (playerAnswer.isCorrect === true) : false,
              timeSpent: playerAnswer?.timeSpent ?? null
            };
          });

          return {
            userId: player.userId,
            playerName: player.playerName,
            avatar: avatarDisplay,
            score: player.score,
            totalPoints: player.score,
            rank: index + 1,
            answers: answersHistory
          };
        });

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
          results: {
            players: rankedPlayers,
            quiz: {
              _id: liveGame.quiz._id,
              title: liveGame.quiz.title
            }
          },
          gameHistoryId: gameHistory._id
        }
      });
    }

    liveGame.currentQuestion += 1;
    liveGame.questionStartedAt = new Date();
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

    // Auto-submit all remaining auto-saved answers before ending game
    console.log('🔄 Auto-submitting all remaining answers before game end');

    liveGame.players.forEach((player, playerIndex) => {
      if (!Array.isArray(player.answers)) return;

      player.answers.forEach((answer, answerIndex) => {
        if (answer.autoSaved === true) {
          const question = liveGame.quiz.questions.find(q => 
            q._id.toString() === answer.questionId.toString()
          );

          if (!question) return;

          console.log(`⚡ Auto-submitting for ${player.playerName}: question ${question.question.substring(0, 30)}...`);

          // Validate answer and calculate score
          const normalize = (value) => {
            if (value === undefined || value === null) return '';
            if (typeof value === 'string') return value.trim().toLowerCase();
            if (typeof value === 'number' || typeof value === 'boolean') {
              return String(value).trim().toLowerCase();
            }
            return value;
          };

          const isArrayAnswer = Array.isArray(answer.answer);
          const normalizedAnswerArray = isArrayAnswer
            ? answer.answer.map(val => normalize(val)).sort()
            : null;
          const normalizedAnswerValue = !isArrayAnswer ? normalize(answer.answer) : null;

          let isCorrect = false;
          const correctAnswer = question.correctAnswer;

          // Empty answer is always wrong
          const hasNoAnswer = (isArrayAnswer && answer.answer.length === 0) || 
                              (!isArrayAnswer && (answer.answer === '' || answer.answer === null || answer.answer === undefined));
          
          if (hasNoAnswer) {
            isCorrect = false;
          } else if (Array.isArray(correctAnswer)) {
            const correctIsIndices = correctAnswer.every(val => typeof val === 'number');
            let normalizedCorrectArray;
            
            if (correctIsIndices && question.options) {
              const correctTexts = correctAnswer.map(idx => question.options[idx]).filter(Boolean);
              normalizedCorrectArray = correctTexts.map(val => normalize(val)).sort();
            } else {
              normalizedCorrectArray = correctAnswer.map(val => normalize(val)).sort();
            }

            if (normalizedAnswerArray) {
              isCorrect = normalizedAnswerArray.length === normalizedCorrectArray.length &&
                normalizedAnswerArray.every((val, idx) => val === normalizedCorrectArray[idx]);
            } else if (normalizedAnswerValue !== null && normalizedAnswerValue !== '') {
              isCorrect = normalizedCorrectArray.includes(normalizedAnswerValue);
            }
          } else {
            if (typeof correctAnswer === 'number' && question.options && question.options[correctAnswer]) {
              isCorrect = normalize(question.options[correctAnswer]) === normalizedAnswerValue;
            } else {
              isCorrect = normalize(correctAnswer) === normalizedAnswerValue;
            }
          }

          // Check accepted answers if available
          if (!hasNoAnswer && !isCorrect && Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0) {
            const normalizedAccepted = question.acceptedAnswers.map(val => normalize(val));
            if (normalizedAnswerArray) {
              const acceptedSet = new Set(normalizedAccepted);
              isCorrect = normalizedAnswerArray.every(val => acceptedSet.has(val));
            } else if (normalizedAnswerValue !== null) {
              isCorrect = normalizedAccepted.includes(normalizedAnswerValue);
            }
          }

          // Update score if correct
          if (isCorrect) {
            liveGame.players[playerIndex].score += (question.points || 1);
          }

          // Mark as submitted
          liveGame.players[playerIndex].answers[answerIndex].isCorrect = isCorrect;
          liveGame.players[playerIndex].answers[answerIndex].answeredAt = new Date();
          liveGame.players[playerIndex].answers[answerIndex].autoSaved = false;
          liveGame.players[playerIndex].answers[answerIndex].timeSpent = question.timeLimit || 0;

          console.log(`✅ Auto-submitted: ${player.playerName} - ${isCorrect ? 'Correct' : 'Wrong'} - Score: ${liveGame.players[playerIndex].score}`);
        }
      });
    });

    liveGame.gameStatus = 'ended';
    liveGame.endedAt = new Date();

    // Set quiz back to public when game ends AND clear active PIN data
    // Quiz kembali muncul di daftar public setelah PIN kadaluarsa/dibatalkan
    if (liveGame.quiz && liveGame.quiz.isPublished) {
      liveGame.quiz.isPublic = true;
      // Clear active PIN data so monitoring button disappears
      liveGame.quiz.activePIN = null;
      liveGame.quiz.pinExpiresAt = null;
      liveGame.quiz.activeGameId = null;
      await liveGame.quiz.save();
    }

    // Rank players
    const rankedPlayers = [...liveGame.players]
      .sort((a, b) => b.score - a.score)
      .map((player, index) => {
        const avatarDisplay = typeof player.avatar === 'object' && player.avatar?.emoji
          ? player.avatar.emoji
          : (player.avatar || '👤');

        // Show ALL questions, not just answered ones
        const answersHistory = liveGame.quiz.questions.map((question) => {
          // Find player's answer for this question (if any)
          const playerAnswer = Array.isArray(player.answers)
            ? player.answers.find(ans => 
                ans.questionId.toString() === question._id.toString() &&
                ans.answeredAt && !ans.autoSaved // Only final submissions
              )
            : null;

          // Format user answer
          let userAnswerDisplay = 'No answer';
          if (playerAnswer && playerAnswer.answer !== undefined && playerAnswer.answer !== null && playerAnswer.answer !== '') {
            if (Array.isArray(playerAnswer.answer)) {
              userAnswerDisplay = playerAnswer.answer.length > 0 ? playerAnswer.answer.join(', ') : 'No answer';
            } else {
              userAnswerDisplay = String(playerAnswer.answer);
            }
          }

          // Format correct answer
          let correctAnswerDisplay = 'N/A';
          if (question.correctAnswer !== undefined && question.correctAnswer !== null) {
            const correctAns = question.correctAnswer;
            if (Array.isArray(correctAns)) {
              if (correctAns.every(val => typeof val === 'number') && question.options) {
                correctAnswerDisplay = correctAns.map(idx => question.options[idx]).filter(Boolean).join(', ');
              } else {
                correctAnswerDisplay = correctAns.join(', ');
              }
            } else if (typeof correctAns === 'number' && question.options && question.options[correctAns]) {
              correctAnswerDisplay = question.options[correctAns];
            } else {
              correctAnswerDisplay = String(correctAns);
            }
          }

          return {
            questionId: question._id,
            question: question.question || 'Unknown question',
            userAnswer: userAnswerDisplay,
            correctAnswer: correctAnswerDisplay,
            isCorrect: playerAnswer ? (playerAnswer.isCorrect === true) : false,
            timeSpent: playerAnswer?.timeSpent ?? null
          };
        });

        return {
          userId: player.userId,
          playerName: player.playerName,
          avatar: avatarDisplay,
          score: player.score,
          totalPoints: player.score,
          rank: index + 1,
          answers: answersHistory
        };
      });

    // Save to GameHistory
    const gameHistory = await GameHistory.create({
      hostId: liveGame.host,
      quizId: liveGame.quiz,
      PIN: liveGame.PIN,
      playerResults: rankedPlayers,
      totalPlayers: liveGame.players.length,
      startedAt: liveGame.startedAt,
      endedAt: liveGame.endedAt,
      pinDurationHours: liveGame.pinDurationHours || 8 // Save PIN duration
    });

    await liveGame.save();

    res.status(200).json({
      status: 'success',
      message: 'Game ended',
      data: {
        results: {
          players: rankedPlayers,
          quiz: {
            _id: liveGame.quiz._id,
            title: liveGame.quiz.title
          }
        },
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
      .populate('quizId', 'title category coverImage questions')
      .populate('hostId', 'name')
      .sort({ completedAt: -1 });

    // Find games where user was host
    const hostGames = await GameHistory.find({
      hostId: req.userId
    })
      .populate('quizId', 'title category coverImage questions')
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
        totalQuestions: game.quizId?.questions?.length || 0,
        yourRank: userResult?.rank || 0,
        yourScore: userResult?.score || 0,
        topScore: game.playerResults[0]?.score || 0,
        avgScore: Math.round(
          game.playerResults.reduce((sum, p) => sum + (p.score || 0), 0) / game.playerResults.length
        ),
        duration: game.pinDurationHours 
          ? `${game.pinDurationHours} jam`
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
        totalQuestions: game.quizId?.questions?.length || 0,
        topScore: game.playerResults[0]?.score || 0,
        avgScore: Math.round(
          game.playerResults.reduce((sum, p) => sum + (p.score || 0), 0) / game.playerResults.length
        ),
        duration: game.pinDurationHours 
          ? `${game.pinDurationHours} jam`
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
