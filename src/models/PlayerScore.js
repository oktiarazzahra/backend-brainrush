const mongoose = require('mongoose');

const playerScoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  mode: {
    type: String,
    enum: ['live', 'learning'],
    required: true
  },
  score: {
    type: Number,
    default: 0
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    userAnswer: mongoose.Schema.Types.Mixed, // Can be String, Number, Boolean, or Array
    isCorrect: Boolean,
    timeSpent: Number
  }],
  completedAt: {
    type: Date,
    default: Date.now
  },
  // Fields for in-progress quiz
  isCompleted: {
    type: Boolean,
    default: false
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  // Timer state
  timeLeft: {
    type: Number,
    default: null // Time left in seconds
  },
  timerMode: {
    type: String,
    enum: ['none', 'per-question', 'total-time'],
    default: 'per-question'
  },
  totalTimeSpent: {
    type: Number,
    default: 0 // Total time spent on quiz in seconds
  }
}, { timestamps: true });

module.exports = mongoose.model('PlayerScore', playerScoreSchema);
