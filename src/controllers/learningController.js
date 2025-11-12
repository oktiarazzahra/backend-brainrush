const PlayerScore = require('../models/PlayerScore');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');

// @route   POST /api/learning/start/:quizId
// @desc    Start learning/practice quiz
// @access  Private
exports.startLearning = async (req, res, next) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findById(quizId)
      .populate('questions');

    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        message: 'Quiz not found'
      });
    }

    // Check if quiz is published and public
    if (quiz.status !== 'published' || !quiz.isPublic) {
      return res.status(403).json({
        status: 'error',
        message: 'This quiz is not available for practice'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Quiz loaded',
      data: {
        quiz: {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          totalQuestions: quiz.questions.length,
          timeLimit: quiz.timeLimit,
          questions: quiz.questions.map(q => ({
            id: q._id,
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options,
            points: q.points
            // Don't include correctAnswer yet
          }))
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

// @route   POST /api/learning/submit
// @desc    Submit learning quiz answers
// @access  Private
exports.submitLearning = async (req, res, next) => {
  try {
    const { quizId, answers } = req.body;

    if (!quizId || !answers) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide quiz ID and answers'
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

    // Calculate score
    let totalScore = 0;
    let correctAnswers = 0;
    const answersDetails = [];

    for (const answer of answers) {
      const question = quiz.questions.find(q => 
        q._id.toString() === answer.questionId
      );

      if (!question) continue;

      const isCorrect = question.correctAnswer === answer.answer;
      if (isCorrect) {
        totalScore += question.points;
        correctAnswers += 1;
      }

      answersDetails.push({
        questionId: question._id,
        userAnswer: answer.answer,
        isCorrect,
        timeSpent: answer.timeSpent || 0
      });
    }

    const totalPoints = quiz.questions.reduce((sum, q) => sum + q.points, 0);

    // Save to PlayerScore
    const playerScore = await PlayerScore.create({
      userId: req.userId,
      quizId,
      mode: 'learning',
      score: totalScore,
      totalPoints,
      answers: answersDetails
    });

    res.status(201).json({
      status: 'success',
      message: 'Quiz submitted successfully',
      data: {
        results: {
          id: playerScore._id,
          score: totalScore,
          totalPoints,
          correctAnswers,
          totalQuestions: quiz.questions.length,
          percentage: Math.round((totalScore / totalPoints) * 100),
          answers: answersDetails.map(a => ({
            questionId: a.questionId,
            userAnswer: a.userAnswer,
            isCorrect: a.isCorrect
          }))
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

// @route   GET /api/learning/history
// @desc    Get user's learning history
// @access  Private
exports.getLearningHistory = async (req, res, next) => {
  try {
    const playerScores = await PlayerScore.find({
      userId: req.userId,
      mode: 'learning'
    })
      .populate('quizId', 'title category')
      .sort({ completedAt: -1 });

    res.status(200).json({
      status: 'success',
      count: playerScores.length,
      data: {
        history: playerScores.map(ps => ({
          id: ps._id,
          quizTitle: ps.quizId.title,
          category: ps.quizId.category,
          score: ps.score,
          totalPoints: ps.totalPoints,
          percentage: Math.round((ps.score / ps.totalPoints) * 100),
          completedAt: ps.completedAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/learning/:scoreId
// @desc    Get learning result details with explanations
// @access  Private
exports.getLearningResult = async (req, res, next) => {
  try {
    const playerScore = await PlayerScore.findById(req.params.scoreId)
      .populate('quizId')
      .populate({
        path: 'answers.questionId',
        model: 'Question'
      });

    if (!playerScore) {
      return res.status(404).json({
        status: 'error',
        message: 'Result not found'
      });
    }

    // Check ownership
    if (playerScore.userId.toString() !== req.userId) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized'
      });
    }

    // Build detailed result with explanations
    const quiz = await Quiz.findById(playerScore.quizId)
      .populate('questions');

    const detailedAnswers = playerScore.answers.map((answer, index) => {
      const question = quiz.questions.find(q => 
        q._id.toString() === answer.questionId._id.toString()
      );

      return {
        questionNumber: index + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        userAnswer: answer.userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: answer.isCorrect,
        explanation: question.explanation,
        points: question.points,
        options: question.options
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        result: {
          id: playerScore._id,
          quizTitle: quiz.title,
          quizCategory: quiz.category,
          score: playerScore.score,
          totalPoints: playerScore.totalPoints,
          percentage: Math.round((playerScore.score / playerScore.totalPoints) * 100),
          completedAt: playerScore.completedAt,
          answers: detailedAnswers
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

// @route   GET /api/learning/stats
// @desc    Get user's learning stats
// @access  Private
exports.getLearningStats = async (req, res, next) => {
  try {
    const playerScores = await PlayerScore.find({
      userId: req.userId,
      mode: 'learning'
    });

    const totalQuizzesCompleted = playerScores.length;
    const totalScore = playerScores.reduce((sum, ps) => sum + ps.score, 0);
    const totalPoints = playerScores.reduce((sum, ps) => sum + ps.totalPoints, 0);
    const averagePercentage = totalQuizzesCompleted > 0 
      ? Math.round((totalScore / totalPoints) * 100) 
      : 0;

    // Best quiz
    const bestQuiz = playerScores.length > 0
      ? playerScores.reduce((best, current) => 
          (current.score / current.totalPoints) > (best.score / best.totalPoints) 
            ? current 
            : best
        )
      : null;

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalQuizzesCompleted,
          totalScore,
          totalPoints,
          averagePercentage,
          bestQuizScore: bestQuiz ? bestQuiz.score : 0,
          bestQuizPercentage: bestQuiz 
            ? Math.round((bestQuiz.score / bestQuiz.totalPoints) * 100) 
            : 0
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
