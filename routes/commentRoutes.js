import express from 'express';
import { isAuthenticated } from '../middlewares/auth.js';
import * as commentController from '../controllers/commentController.js';

const router = express.Router();

// Post comment

router.route('/comment').post(isAuthenticated, commentController.addCommentToCourse);
router.route('/comment/course/:courseId').get(isAuthenticated, commentController.getCommentById);

export default router;
