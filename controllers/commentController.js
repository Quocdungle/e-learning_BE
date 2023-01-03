import { catchAsyncError } from '../middlewares/catchAsyncError.js';
import { Course } from '../models/Course.js';
import * as Message from '../constants/Message.js';

export const addCommentToCourse = async (req, res) => {
  try {
    const { comment } = req.body;

    await Course.updateOne(
      {
        _id: comment.courseId,
      },
      {
        $push: {
          comments: {
            title: comment.title,
            user_id: req.user._id,
            userName: comment.userName,
            createdAt: Date.now(),
          },
        },
      }
    );

    res.status(200).json({
      success: true,
      message: Message.SUCCESS,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCommentById = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { comments } = await Course.findById(courseId, { comments: 1});

    res.status(200).json({
      success: true,
      message: Message.SUCCESS,
      data: {
        comments,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error.message,
    });
  }
};
