import express from "express";
import {
  buySubscription,
  cancelSubscription,
  getRazorPayKey,
  paymentVerification,
  getPaymentByUser,
  activate,
  deactivate,
  sendmomo,
  momoSuccess,
  VNPAYsuccess,
  sendVNPay,
} from "../controllers/paymentController.js";
import { isAuthenticated } from "../middlewares/auth.js";

const router = express.Router();

// Buy Subscription
router.route("/subscribe").get(isAuthenticated, buySubscription);
// router.route('/pay/momo/:userId').get(isAuthenticated, sendmomo);
router.route("/pay/momo/success").get(momoSuccess);
router.route("/pay/momo/:userId").get(sendmomo);

router.route("/pay/vnpay/success").get(VNPAYsuccess);
router.route("/pay/vnpay/:userId").get(sendVNPay);

// Verify Payment and save reference in database
router.route("/paymentverification").post(isAuthenticated, paymentVerification);

// Get Razorpay key
router.route("/razorpaykey").get(getRazorPayKey);

// Cancel Subscription
router.route("/subscribe/cancel").delete(isAuthenticated, cancelSubscription);
router.route("/subscribe/info").get(getPaymentByUser);
router.route("/subscribe/info/:userId").put(activate);
router.route("/subscribe/info/:userId").delete(deactivate);

export default router;
