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
    const { quizId, answers, progressId } = req.body;

    console.log('📥 Received submission:', { quizId, answersCount: answers?.length, userId: req.userId, progressId });

    if (!quizId || !answers) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide quiz ID and answers'
      });
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        message: 'Quiz not found'
      });
    }

    console.log('✅ Quiz found:', quiz.title);
    console.log('📊 Quiz has', quiz.questions.length, 'questions (embedded)');

    // Calculate score
    let totalScore = 0;
    let correctAnswers = 0;
    const answersDetails = [];

    console.log('📝 Processing answers for quiz:', quizId);
    console.log('📊 Total questions:', quiz.questions.length);
    console.log('📋 Answers received:', answers.length);

    for (const answer of answers) {
      const question = quiz.questions.find(q => 
        q._id.toString() === answer.questionId
      );

      if (!question) {
        console.warn('⚠️ Question not found for ID:', answer.questionId);
        continue;
      }

      let isCorrect = false;
      
      // Normalize question type
      const questionType = question.questionType;
      
      console.log(`\n🔍 Checking question:`, {
        questionId: question._id,
        questionType: questionType,
        correctAnswer: question.correctAnswer,
        userAnswer: answer.answer
      });
      
      // Check answer based on question type
      if (questionType === 'multiple-choice' || questionType === 'multiple-answer' || questionType === 'Pilihan Ganda') {
        // For multiple choice/answer questions
        // Normalize to arrays for comparison
        const correctAnswer = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
        const userAnswer = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
        
        // Sort arrays for comparison
        const sortedCorrect = [...correctAnswer].map(a => Number(a)).sort();
        const sortedUser = [...userAnswer].map(a => Number(a)).sort();
        
        console.log('Comparing arrays:', { sortedCorrect, sortedUser });
        
        isCorrect = JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
      } else if (questionType === 'true-false' || questionType === 'Benar Salah') {
        // For true/false questions - handle both string and boolean + Indonesian language
        console.log('Comparing bool:', { correct: question.correctAnswer, user: answer.answer, types: [typeof question.correctAnswer, typeof answer.answer] });
        
        // PENTING: Jika tidak dijawab (null/undefined), otomatis salah
        if (answer.answer === null || answer.answer === undefined) {
          isCorrect = false;
          console.log('Not answered - marked as wrong');
        } else {
          // Normalize function for True/False mapping
          const normalizeBoolean = (value) => {
            if (value === true || value === 'true' || value === 'True' || value === 'benar' || value === 'Benar') return 'true';
            if (value === false || value === 'false' || value === 'False' || value === 'salah' || value === 'Salah') return 'false';
            return String(value).toLowerCase();
          };
          
          const correctNormalized = normalizeBoolean(question.correctAnswer);
          const userNormalized = normalizeBoolean(answer.answer);
          
          console.log('After normalization:', { correctNormalized, userNormalized });
          
          isCorrect = correctNormalized === userNormalized;
        }
      } else if (questionType === 'short-answer' || questionType === 'Isian') {
        // For short answer questions - case insensitive
        const acceptedAnswers = question.acceptedAnswers || [];
        const userAnswerRaw = answer.answer;
        
        console.log('📝 Short answer check:', { 
          userAnswerRaw, 
          type: typeof userAnswerRaw,
          acceptedAnswers 
        });
        
        // PENTING: Cek apakah benar-benar dijawab (bukan empty string atau null)
        if (!userAnswerRaw || 
            (typeof userAnswerRaw === 'string' && userAnswerRaw.trim() === '')) {
          isCorrect = false;
          console.log('❌ Short answer: Empty or not answered');
        } else {
          const userAnswerLower = userAnswerRaw.toString().toLowerCase().trim();
          
          console.log('Comparing text (normalized):', { 
            acceptedAnswers: acceptedAnswers.map(a => a.toLowerCase().trim()), 
            userAnswerLower 
          });
          
          if (acceptedAnswers.length === 0) {
            console.log('⚠️ No accepted answers defined for this question');
            isCorrect = false;
          } else {
            isCorrect = acceptedAnswers.some(accepted => 
              accepted.toLowerCase().trim() === userAnswerLower
            );
          }
        }
      } else {
        // Default comparison
        console.log('Default comparison:', { correct: question.correctAnswer, user: answer.answer });
        isCorrect = question.correctAnswer === answer.answer;
      }

      console.log(`${isCorrect ? '✅' : '❌'} Answer is ${isCorrect ? 'CORRECT' : 'WRONG'}`);

      if (isCorrect) {
        totalScore += (question.points || 1);
        correctAnswers += 1;
      }

      answersDetails.push({
        questionId: question._id,
        userAnswer: answer.answer,
        isCorrect,
        timeSpent: answer.timeSpent || 0
      });
    }

    const totalPoints = quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);

    console.log('📊 Final score:', totalScore, '/', totalPoints);
    console.log('📊 Correct answers:', correctAnswers, '/', quiz.questions.length);

    // Save or update PlayerScore
    console.log('💾 Saving to database...');
    let playerScore;
    
    if (progressId) {
      // Update existing progress
      playerScore = await PlayerScore.findByIdAndUpdate(
        progressId,
        {
          score: totalScore,
          totalPoints,
          answers: answersDetails,
          isCompleted: true,
          currentQuestionIndex: quiz.questions.length,
          completedAt: new Date()
        },
        { new: true }
      );
      console.log('✅ Updated existing progress with ID:', playerScore._id);
    } else {
      // Create new record
      playerScore = await PlayerScore.create({
        userId: req.userId,
        quizId,
        mode: 'learning',
        score: totalScore,
        totalPoints,
        answers: answersDetails,
        isCompleted: true,
        totalQuestions: quiz.questions.length,
        currentQuestionIndex: quiz.questions.length
      });
      console.log('✅ Saved successfully with ID:', playerScore._id);
    }

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
    console.error('❌ Error in submitLearning:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   POST /api/learning/save-progress
// @desc    Save progress when user hasn't finished quiz
// @access  Private
exports.saveProgress = async (req, res, next) => {
  try {
    const { quizId, currentQuestionIndex, answers, totalQuestions, timeLeft, timerMode, totalTimeSpent, quizEndTime } = req.body;

    console.log('💾 Saving progress:', { quizId, currentQuestionIndex, totalQuestions, timeLeft, timerMode, quizEndTime, userId: req.userId });

    if (!quizId || currentQuestionIndex === undefined || !totalQuestions) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide quizId, currentQuestionIndex, and totalQuestions'
      });
    }

    // Check if progress already exists
    let progress = await PlayerScore.findOne({
      userId: req.userId,
      quizId,
      mode: 'learning',
      isCompleted: false
    });

    if (progress) {
      // Update existing progress
      progress.currentQuestionIndex = currentQuestionIndex;
      progress.answers = answers || [];
      progress.totalQuestions = totalQuestions;
      progress.timeLeft = timeLeft !== undefined ? timeLeft : progress.timeLeft;
      progress.timerMode = timerMode || progress.timerMode;
      progress.totalTimeSpent = totalTimeSpent !== undefined ? totalTimeSpent : progress.totalTimeSpent;
      progress.quizEndTime = quizEndTime || progress.quizEndTime;
      await progress.save();
      console.log('✅ Updated existing progress');
    } else {
      // Create new progress
      progress = await PlayerScore.create({
        userId: req.userId,
        quizId,
        mode: 'learning',
        currentQuestionIndex,
        totalQuestions,
        answers: answers || [],
        isCompleted: false,
        score: 0,
        totalPoints: totalQuestions,
        timeLeft: timeLeft || null,
        timerMode: timerMode || 'per-question',
        totalTimeSpent: totalTimeSpent || 0,
        startedAt: new Date(), // Save when quiz was first started
        quizEndTime: quizEndTime ? new Date(quizEndTime) : null // Save absolute end time
      });
      console.log('✅ Created new progress');
    }

    res.status(200).json({
      status: 'success',
      message: 'Progress saved',
      data: {
        progressId: progress._id,
        currentQuestionIndex: progress.currentQuestionIndex
      }
    });
  } catch (error) {
    console.error('❌ Error saving progress:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/learning/progress/:quizId
// @desc    Get saved progress for a quiz
// @access  Private
exports.getProgress = async (req, res, next) => {
  try {
    const { quizId } = req.params;

    console.log('📥 Loading progress for quiz:', quizId);

    const progress = await PlayerScore.findOne({
      userId: req.userId,
      quizId,
      mode: 'learning',
      isCompleted: false
    });

    if (!progress) {
      return res.status(404).json({
        status: 'error',
        message: 'No progress found'
      });
    }

    console.log('✅ Progress found:', progress.currentQuestionIndex, '/', progress.totalQuestions);

    res.status(200).json({
      status: 'success',
      data: {
        progress: {
          id: progress._id,
          currentQuestionIndex: progress.currentQuestionIndex,
          totalQuestions: progress.totalQuestions,
          answers: progress.answers,
          timeLeft: progress.timeLeft,
          timerMode: progress.timerMode,
          totalTimeSpent: progress.totalTimeSpent || 0,
          startedAt: progress.startedAt, // Timestamp when quiz was first started
          quizEndTime: progress.quizEndTime // Absolute end time based on system time
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading progress:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// @route   GET /api/learning/history
// @desc    Get user's learning history (completed only)
// @access  Private
exports.getLearningHistory = async (req, res, next) => {
  try {
    console.log('📥 Getting learning history for user:', req.userId);
    
    const playerScores = await PlayerScore.find({
      userId: req.userId,
      mode: 'learning',
      isCompleted: true
    })
      .populate('quizId', 'title category coverImage')
      .sort({ completedAt: -1 });

    console.log('✅ Found', playerScores.length, 'completed quizzes');

    // Also get in-progress quizzes - HANYA yang tanpa timer (none mode)
    // Quiz dengan timer yang keluar dianggap selesai dan masuk history
    const inProgressQuizzes = await PlayerScore.find({
      userId: req.userId,
      mode: 'learning',
      isCompleted: false,
      timerMode: 'none' // Hanya quiz tanpa timer yang bisa di-continue
    })
      .populate('quizId', 'title category coverImage')
      .sort({ updatedAt: -1 });

    console.log('✅ Found', inProgressQuizzes.length, 'in-progress quizzes (timer mode: none only)');

    // Filter out records where quizId is null (quiz was deleted)
    const validPlayerScores = playerScores.filter(ps => ps.quizId != null);
    const validInProgress = inProgressQuizzes.filter(ps => ps.quizId != null);

    console.log('✅ Valid completed:', validPlayerScores.length, 'Valid in-progress:', validInProgress.length);

    res.status(200).json({
      status: 'success',
      count: validPlayerScores.length,
      data: {
        history: validPlayerScores.map(ps => ({
          id: ps._id,
          quizTitle: ps.quizId.title,
          category: ps.quizId.category || 'Umum',
          coverImage: ps.quizId.coverImage || null,
          score: ps.score,
          totalPoints: ps.totalPoints,
          percentage: Math.round((ps.score / ps.totalPoints) * 100),
          completedAt: ps.completedAt,
          isCompleted: true
        })),
        inProgress: validInProgress.map(ps => ({
          id: ps._id,
          quizId: ps.quizId._id,
          quizTitle: ps.quizId.title,
          category: ps.quizId.category || 'Umum',
          coverImage: ps.quizId.coverImage || null,
          currentQuestionIndex: ps.currentQuestionIndex,
          totalQuestions: ps.totalQuestions,
          isCompleted: false,
          lastUpdated: ps.updatedAt
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error in getLearningHistory:', error);
    console.error('Stack:', error.stack);
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
    console.log('📥 Fetching learning result for scoreId:', req.params.scoreId);

    const playerScore = await PlayerScore.findById(req.params.scoreId)
      .populate('quizId');

    if (!playerScore) {
      console.log('❌ PlayerScore not found');
      return res.status(404).json({
        status: 'error',
        message: 'Result not found'
      });
    }

    console.log('✅ PlayerScore found');

    // Check ownership
    if (playerScore.userId.toString() !== req.userId) {
      console.log('❌ Not authorized - userId mismatch');
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized'
      });
    }

    // Get quiz with embedded questions
    const quiz = await Quiz.findById(playerScore.quizId);

    if (!quiz) {
      console.log('❌ Quiz not found');
      return res.status(404).json({
        status: 'error',
        message: 'Quiz not found'
      });
    }

    console.log('✅ Quiz found:', quiz.title);
    console.log('📊 Building detailed answers...');

    const detailedAnswers = playerScore.answers.map((answer, index) => {
      // Find question from embedded quiz.questions array
      const question = quiz.questions.find(q => 
        q._id.toString() === answer.questionId.toString()
      );

      if (!question) {
        console.warn('⚠️ Question not found for ID:', answer.questionId);
        return null;
      }

      return {
        questionNumber: index + 1,
        questionText: question.question, // Use 'question' not 'questionText'
        questionType: question.questionType,
        userAnswer: answer.userAnswer,
        correctAnswer: question.correctAnswer,
        acceptedAnswers: question.acceptedAnswers || [], // For short answer questions
        isCorrect: answer.isCorrect,
        explanation: question.explanation || 'Tidak ada penjelasan.',
        points: question.points || 1,
        options: question.options || []
      };
    }).filter(a => a !== null); // Remove null entries

    console.log('✅ Built', detailedAnswers.length, 'detailed answers');

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
    console.error('❌ Error in getLearningResult:', error);
    console.error('Stack:', error.stack);
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
