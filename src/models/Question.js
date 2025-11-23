const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  question: {
    type: String,
    required: [true, 'Please provide question text'],
  },
  questionType: {
    type: String,
    enum: ['Pilihan Ganda', 'Benar Salah', 'Isian', 'multiple-choice', 'multiple-answer', 'true-false', 'short-answer'],
    default: 'Pilihan Ganda',
  },
  options: [
    {
      type: String,
    },
  ],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
  },
  acceptedAnswers: [String],
  explanation: String,
  points: {
    type: Number,
    default: 1,
  },
  timeLimit: {
    type: Number,
    default: 30,
  },
  orderIndex: {
    type: Number,
  },
  imageUrl: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
},
{ timestamps: true });

module.exports = mongoose.model('Question', questionSchema);