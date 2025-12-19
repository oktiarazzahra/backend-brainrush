const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const Quiz = require('../models/Quiz');
const quizController = require('../controllers/quizController');

// Setup multer untuk upload gambar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/covers/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'cover-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed!'));
    }
  }
});

// @route GET /api/quizzes/published
// @desc Get all published and public quizzes
// @access Private
router.get('/published', protect, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ 
      isPublished: true,
      isPublic: true
    })
      .populate('createdBy', 'name email fullName')
      .sort({ createdAt: -1 });
    
    // Ensure createdBy is populated with name
    const enrichedQuizzes = quizzes.map(quiz => {
      const quizObj = quiz.toObject();
      if (quizObj.createdBy) {
        // Use fullName or name, whichever is available
        quizObj.createdBy.name = quizObj.createdBy.fullName || quizObj.createdBy.name || 'Anonymous';
      }
      return quizObj;
    });
    
    res.json({ quizzes: enrichedQuizzes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route GET /api/quizzes/my-quizzes
// @desc Get user's quizzes
// @access Private
router.get('/my-quizzes', protect, async (req, res) => {
  try {
    // Auto-update old published quizzes without isPublic field
    await Quiz.updateMany(
      { 
        createdBy: req.user._id,
        isPublished: true,
        isPublic: { $exists: false }
      },
      { $set: { isPublic: true } }
    );
    
    // Fetch updated quizzes
    const quizzes = await Quiz.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ quizzes });
  } catch (error) {
    console.error('❌ Get quizzes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route POST /api/quizzes
// @desc Create a new quiz
// @access Private
router.post('/', protect, quizController.createQuiz);

// @route PUT /api/quizzes/:id/publish
// @desc Publish quiz
// @access Private
router.put('/:id/publish', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    quiz.isDraft = false;
    quiz.isPublished = true;
    quiz.status = 'published';
    quiz.isPublic = true; // Auto set to public when published
    await quiz.save();
    res.json({ message: 'Quiz published successfully', quiz });
  } catch (error) {
    console.error('❌ Publish quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route PUT /api/quizzes/:id/unpublish
// @desc Unpublish quiz
// @access Private
router.put('/:id/unpublish', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    quiz.isDraft = true;
    quiz.isPublished = false;
    quiz.status = 'draft';
    quiz.isPublic = false; // Auto set to private when unpublished
    await quiz.save();
    res.json({ message: 'Quiz unpublished successfully', quiz });
  } catch (error) {
    console.error('❌ Unpublish quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route PUT /api/quizzes/:id/public
// @desc Set quiz as public
// @access Private
router.put('/:id/public', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    quiz.isPublic = true;
    await quiz.save();
    res.json({ message: 'Quiz set to public successfully', quiz });
  } catch (error) {
    console.error('❌ Set public error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route PUT /api/quizzes/:id/private
// @desc Set quiz as private
// @access Private
router.put('/:id/private', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    quiz.isPublic = false;
    await quiz.save();
    res.json({ message: 'Quiz set to private successfully', quiz });
  } catch (error) {
    console.error('❌ Set private error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route PUT /api/quizzes/:id/cover
// @desc Upload quiz cover image (DEPRECATED - use PUT /api/quizzes/:id with coverImage field instead)
// @access Private
// router.put('/:id/cover', protect, upload.single('cover'), async (req, res) => {
//   try {
//     const quiz = await Quiz.findById(req.params.id);
//     
//     if (!quiz) {
//       return res.status(404).json({ message: 'Quiz not found' });
//     }

//     if (quiz.createdBy.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ message: 'Not authorized to update this quiz' });
//     }

//     quiz.coverImage = `/uploads/covers/${req.file.filename}`;
//     await quiz.save();

//     res.json({ 
//       message: 'Cover uploaded successfully', 
//       coverImage: quiz.coverImage 
//     });
//   } catch (error) {
//     console.error('❌ Upload cover error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// @route DELETE /api/quizzes/:id/cover
// @desc Delete quiz cover image (DEPRECATED - use PUT /api/quizzes/:id with coverImage: null instead)
// @access Private
// router.delete('/:id/cover', protect, async (req, res) => {
//   try {
//     const quiz = await Quiz.findById(req.params.id);
//     
//     if (!quiz) {
//       return res.status(404).json({ message: 'Quiz not found' });
//     }

//     if (quiz.createdBy.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ message: 'Not authorized to delete this cover' });
//     }

//     quiz.coverImage = null;
//     await quiz.save();

//     res.json({ 
//       message: 'Cover deleted successfully', 
//       coverImage: null 
//     });
//   } catch (error) {
//     console.error('❌ Delete cover error:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// });

// @route PUT /api/quizzes/:id
// @desc Update quiz
// @access Private
router.put('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const updatedQuiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedQuiz);
  } catch (error) {
    console.error('❌ Update quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route DELETE /api/quizzes/:id
// @desc Delete quiz
// @access Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (quiz.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('❌ Delete quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route GET /api/quizzes/:id
// @desc Get single quiz
// @access Private
router.get('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (error) {
    console.error('❌ Get quiz error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
