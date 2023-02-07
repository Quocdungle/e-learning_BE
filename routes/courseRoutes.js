import express from 'express';
import {
  addLecture,
  createCourse,
  deleteCourse,
  deleteLecture,
  getAllCourses,
  getCourseLectures,
  training1,
  recommendtaion,
} from '../controllers/courseController.js';
import {
  authorizeAdmin,
  isAuthenticated,
  authorizeSubscribers,
} from '../middlewares/auth.js';
import singleUpload from '../middlewares/multer.js';

const router = express.Router();

// Get All courses without lectures
router.route('/courses').get(getAllCourses);

// create new course - only admin
router
  .route('/createcourse')
  .post(isAuthenticated, authorizeAdmin, singleUpload, createCourse);

// Add lecture, Delete Course, Get Course Details
router
  .route('/course/:id')
  .get(isAuthenticated, authorizeSubscribers, getCourseLectures)
  .post(isAuthenticated, authorizeAdmin, singleUpload, addLecture)
  .delete(isAuthenticated, authorizeAdmin, deleteCourse);

// Delete Lecture
router.route('/lecture').delete(isAuthenticated, authorizeAdmin, deleteLecture);

// Training

router.route('/traning').get(training1);
router.route('/recommendation/:id').get(recommendtaion);

export default router;
