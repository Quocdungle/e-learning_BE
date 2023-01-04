import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import * as ratingController from "../controllers/ratingController.js";

const router = express.Router();

// Post comment

router
  .route("/rating")
  .post(isAuthenticated, ratingController.addRatingToCourse);

export default router;
