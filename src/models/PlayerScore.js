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
    userAnswer: String,
    isCorrect: Boolean,
    timeSpent: Number
  }],
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('PlayerScore', playerScoreSchema);
