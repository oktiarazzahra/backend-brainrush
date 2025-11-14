const Quiz = require('../models/Quiz');

exports.createQuiz = async (req, res, next) => {
  try {
    const { title, description, category, questions } = req.body;

    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title dan questions wajib ada'
      });
    }

    // Convert question types dari frontend ke database format
    const formatQuestions = questions.map((q) => {
      let questionType = q.questionType;

      // Map frontend types ke database types
      if (questionType === 'multiple-choice') questionType = 'Pilihan Ganda';
      if (questionType === 'multiple-answer') questionType = 'Pilihan Ganda';
      if (questionType === 'true-false') questionType = 'Benar Salah';
      if (questionType === 'short-answer') questionType = 'Isian';

      return {
        question: q.question,
        questionType: questionType,
        options: q.options || [],
        correctAnswer: q.correctAnswer || null,
        acceptedAnswers: q.acceptedAnswers || [],
        timeLimit: q.timeLimit || 30,
        imageData: q.imageData || null,  // ← NEW: Base64 image
        imageName: q.imageName || null,  // ← NEW: Filename
      };
    });

    const quiz = new Quiz({
      title,
      description: description || '',
      category: category || 'Umum',
      createdBy: req.userId,
      status: 'draft',
      questions: formatQuestions
    });

    await quiz.save();

    return res.status(201).json({
      success: true,
      message: 'Quiz berhasil dibuat!',
      data: quiz
    });
  } catch (error) {
    console.error('Error creating quiz:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat quiz',
      error: error.message
    });
  }
};

exports.getMyQuizzes = async (req, res, next) => {
  try {
    const quizzes = await Quiz.find({ createdBy: req.userId })
      .select('title description category status questions createdAt coverImage')
      .sort('-createdAt');

    return res.status(200).json({
      success: true,
      count: quizzes.length,
      data: quizzes
    });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar quiz',
      error: error.message
    });
  }
};

exports.getQuizById = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz tidak ditemukan'
      });
    }

    if (quiz.createdBy._id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak berhak mengakses quiz ini'
      });
    }

    return res.status(200).json({
      success: true,
      data: quiz
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil quiz',
      error: error.message
    });
  }
};

exports.updateQuiz = async (req, res, next) => {
  try {
    let quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz tidak ditemukan'
      });
    }

    if (quiz.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak berhak mengubah quiz ini'
      });
    }

    const { title, description, category, questions, coverImage } = req.body;

    if (title) quiz.title = title;
    if (description) quiz.description = description;
    if (category) quiz.category = category;
    if (coverImage !== undefined) quiz.coverImage = coverImage; // Support base64 or null to remove

    if (questions && Array.isArray(questions)) {
      const formatQuestions = questions.map((q) => {
        let questionType = q.questionType;

        if (questionType === 'multiple-choice') questionType = 'Pilihan Ganda';
        if (questionType === 'multiple-answer') questionType = 'Pilihan Ganda';
        if (questionType === 'true-false') questionType = 'Benar Salah';
        if (questionType === 'short-answer') questionType = 'Isian';

        return {
          question: q.question,
          questionType: questionType,
          options: q.options || [],
          correctAnswer: q.correctAnswer || null,
          acceptedAnswers: q.acceptedAnswers || [],
          timeLimit: q.timeLimit || 30,
          imageData: q.imageData || null,  // ← NEW: Base64 image
          imageName: q.imageName || null,  // ← NEW: Filename
        };
      });

      quiz.questions = formatQuestions;
    }

    quiz = await quiz.save();

    return res.status(200).json({
      success: true,
      message: 'Quiz berhasil diupdate!',
      data: quiz
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengupdate quiz',
      error: error.message
    });
  }
};

exports.publishQuiz = async (req, res, next) => {
  try {
    let quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz tidak ditemukan'
      });
    }

    if (quiz.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak berhak publish quiz ini'
      });
    }

    quiz.status = 'published';
    quiz.isPublished = true;
    quiz = await quiz.save();

    return res.status(200).json({
      success: true,
      message: 'Quiz berhasil dipublikasikan!',
      data: quiz
    });
  } catch (error) {
    console.error('Error publishing quiz:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal publish quiz',
      error: error.message
    });
  }
};

exports.deleteQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz tidak ditemukan'
      });
    }

    if (quiz.createdBy.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak berhak menghapus quiz ini'
      });
    }

    await Quiz.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Quiz berhasil dihapus!'
    });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus quiz',
      error: error.message
    });
  }
};

exports.checkAnswer = async (req, res, next) => {
  try {
    const { quizId, questionIndex, userAnswer } = req.body;

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz tidak ditemukan'
      });
    }

    const question = quiz.questions[questionIndex];
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Soal tidak ditemukan'
      });
    }

    let isCorrect = false;
    let points = 0;

    if (question.questionType === 'Pilihan Ganda') {
      if (Array.isArray(question.correctAnswer)) {
        isCorrect =
          Array.isArray(userAnswer) &&
          userAnswer.length === question.correctAnswer.length &&
          userAnswer.every((idx) => question.correctAnswer.includes(idx));
      } else {
        isCorrect = question.correctAnswer === userAnswer;
      }
      if (isCorrect) points = 1;
    } else if (question.questionType === 'Benar Salah') {
      isCorrect = question.correctAnswer === userAnswer;
      if (isCorrect) points = 1;
    } else if (question.questionType === 'Isian') {
      const normalizedAnswer = userAnswer.toLowerCase().trim();
      isCorrect = question.acceptedAnswers.some(
        (ans) => ans.toLowerCase().trim() === normalizedAnswer
      );
      if (isCorrect) points = 1;
    }

    return res.status(200).json({
      success: true,
      isCorrect,
      points
    });
  } catch (error) {
    console.error('Error checking answer:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengecek jawaban',
      error: error.message
    });
  }
};