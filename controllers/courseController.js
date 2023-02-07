import { catchAsyncError } from '../middlewares/catchAsyncError.js';
import { Course } from '../models/Course.js';
import { User } from '../models/User.js';
import getDataUri from '../utils/dataUri.js';
import ErrorHandler from '../utils/errorHandler.js';
import cloudinary from 'cloudinary';
import { Stats } from '../models/Stats.js';
import training from '../middlewares/recommend.js';

let predicted_table = {};

export const getAllCourses = catchAsyncError(async (req, res, next) => {
  const keyword = req.query.keyword || '';
  const category = req.query.category || '';

  const courses = await Course.find({
    title: {
      $regex: keyword,
      $options: 'i',
    },
    category: {
      $regex: category,
      $options: 'i',
    },
  }).select('-lectures');
  res.status(200).json({
    success: true,
    courses,
  });
});

export const createCourse = catchAsyncError(async (req, res, next) => {
  const { title, description, category, createdBy } = req.body;

  if (!title || !description || !category || !createdBy)
    return next(new ErrorHandler('Please add all fields', 400));

  const file = req.file;

  const fileUri = getDataUri(file);

  const mycloud = await cloudinary.v2.uploader.upload(fileUri.content);

  await Course.create({
    title,
    description,
    category,
    createdBy,
    poster: {
      public_id: mycloud.public_id,
      url: mycloud.secure_url,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Course Created Successfully. You can add lectures now.',
  });
});

export const getCourseLectures = catchAsyncError(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) return next(new ErrorHandler('Course not found', 404));

  course.views += 1;

  await course.save();

  res.status(200).json({
    success: true,
    lectures: course.lectures,
  });
});

// Max video size 100mb
export const addLecture = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const { title, description } = req.body;

  const course = await Course.findById(id);

  if (!course) return next(new ErrorHandler('Course not found', 404));

  const file = req.file;
  const fileUri = getDataUri(file);

  const mycloud = await cloudinary.v2.uploader.upload(fileUri.content, {
    resource_type: 'video',
  });

  course.lectures.push({
    title,
    description,
    video: {
      public_id: mycloud.public_id,
      url: mycloud.secure_url,
    },
  });

  course.numOfVideos = course.lectures.length;

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Lecture added in Course',
  });
});

export const deleteCourse = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const course = await Course.findById(id);

  if (!course) return next(new ErrorHandler('Course not found', 404));

  await cloudinary.v2.uploader.destroy(course.poster.public_id);

  for (let i = 0; i < course.lectures.length; i++) {
    const singleLecture = course.lectures[i];
    await cloudinary.v2.uploader.destroy(singleLecture.video.public_id, {
      resource_type: 'video',
    });
  }

  await course.remove();

  res.status(200).json({
    success: true,
    message: 'Course Deleted Successfully',
  });
});

export const deleteLecture = catchAsyncError(async (req, res, next) => {
  const { courseId, lectureId } = req.query;

  const course = await Course.findById(courseId);
  if (!course) return next(new ErrorHandler('Course not found', 404));

  const lecture = course.lectures.find((item) => {
    if (item._id.toString() === lectureId.toString()) return item;
  });
  await cloudinary.v2.uploader.destroy(lecture.video.public_id, {
    resource_type: 'video',
  });

  course.lectures = course.lectures.filter((item) => {
    if (item._id.toString() !== lectureId.toString()) return item;
  });

  course.numOfVideos = course.lectures.length;

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Lecture Deleted Successfully',
  });
});

export const training1 = async (req, res, next) => {
  predicted_table = await training();

  res.status(200).json({
    predicted_table,
    message: 'Success traning',
  });
};

export const recommendtaion = catchAsyncError(async (req, res, next) => {
  //
  let findFiveCourseBest = async () =>
    await Course.find().select('_id').limit(5).sort({ views: -1 });

  //
  let userIsReview = async (userId) => {
    const vehicles = await Course.find().lean();
    for (let vehicle of vehicles) {
      if (vehicle.ratings.length > 0) {
        for (let review of vehicle.ratings) {
          console.log(review.user_id);
          if (review.user_id.toString() === userId) {
            return true;
          }
        }
      }
    }
    return false;
  };

  //
  let isEmptyObj = (obj) => {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) return false;
    }
    return true;
  };

  //
  let findTopFiveRecommendation = async (predictData) => {
    const result = [];
    let count = 0;
    console.log(predictData);
    while (result.length < 4) {
      let vehicle = await Course.findById(predictData[count]._id);

      result.push(vehicle);

      console.log(count);
      count += 1;
    }
    return result;
  };

  let predicted_vehicle = await findFiveCourseBest(); // tim 5 xe tot nhat default

  if (await userIsReview(req.params.id)) {
    // user co rating khong
    if (!isEmptyObj(predicted_table)) {
      // predicted_table co rong khong
      predicted_vehicle = [];
      for (var i = 0; i < predicted_table.columnNames.length; ++i) {
        // duyet model moi train
        var user = predicted_table.columnNames[i]; // loc qua tung user

        if (user === req.params.id) {
          // tim ra thang usser dang dang nhap roi predict
          // console.log("For user: " + user);
          for (var j = 0; j < predicted_table.rowNames.length; ++j) {
            var course = predicted_table.rowNames[j]; // lay tat ca course
            // push vao mang co nhieu obj
            predicted_vehicle.push({
              _id: course,
              predict: predicted_table.getCell(course, user), // cho so predict 
            });
          }
        }
        // sort mang do theo so predict
        predicted_vehicle.sort((a, b) => (a.predict > b.predict ? -1 : 1));
      }
    }
    // predicted_vehicle thi cho defaut value
    if (predicted_vehicle.length === 0) {
      predicted_vehicle = await findFiveCourseBest();
    }
  }
  console.log(1);
  // tim 5 course
  const vehiclesResult = await findTopFiveRecommendation(predicted_vehicle);
  console.log(2);
  res.json({
    predicted_vehicle: vehiclesResult,
    success: true,
  });
});

Course.watch().on('change', async () => {
  const stats = await Stats.find({}).sort({ createdAt: 'desc' }).limit(1);

  const courses = await Course.find({});

  let totalViews = 0;

  for (let i = 0; i < courses.length; i++) {
    totalViews += courses[i].views;
  }
  stats[0].views = totalViews;
  stats[0].createdAt = new Date(Date.now());

  await stats[0].save();
});
