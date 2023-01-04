import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { Course } from "../models/Course.js";
import * as Message from "../constants/Message.js";

export const addRatingToCourse = async (req, res) => {
  try {
    const { rating, userName, userAvt } = req.body;

    await Course.updateOne(
      {
        _id: rating.courseId,
      },
      {
        $push: {
          ratings: {
            point: rating.point,
            user_id: req.user._id,
            userName: userName,
            userAvt: userAvt,
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
