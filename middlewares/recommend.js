import { User } from '../models/User.js';
import { Course } from '../models/Course.js';
import jsrecommender from './recommender.js';

const training = async () => {
  var recommender = new jsrecommender.Recommender();
  var table = new jsrecommender.Table();

  for (let user of await User.find().lean()) {
    // console.log('training user ' + user._id);
    for (let course of await Course.find().lean()) {
      if (course.ratings.length > 0) {
        for (let rating of course.ratings) {
          if (user._id.toString() === rating.user_id.toString()) {
            table.setCell(
              course._id.toString(),
              user._id.toString(),
              +rating.point
            );
            break;
          }
          // else {
          //   table.setCell(course._id.toString(), user._id.toString(), 2.5);
          // }
        }
      }
    }
  }

  console.log(table);
  var model = recommender.fit(table);
  console.log(model);

  // predicted_table = recommender.transform(table);

  // console.log(predicted_table);
  return recommender.transform(table);
};

export default training;
