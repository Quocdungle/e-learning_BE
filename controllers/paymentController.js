import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/User.js";
import ErrorHandler from "../utils/errorHandler.js";
import { instance } from "../server.js";
import crypto from "crypto";
import { Payment } from "../models/Payment.js";
import * as Message from "../constants/Message.js";
import { v4 as uuidv4 } from "uuid";
import https from "https";
import dateFormat from "dateformat";
import querystring from "qs";

export const buySubscription = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (user.role === "admin")
    return next(new ErrorHandler("Admin can't buy subscription", 400));

  const plan_id = process.env.PLAN_ID || "plan_JuJevKAcuZdtRO";

  const subscription = await instance.subscriptions.create({
    plan_id,
    customer_notify: 1,
    total_count: 12,
  });

  user.subscription.id = subscription.id;

  user.subscription.status = subscription.status;

  await user.save();

  res.status(201).json({
    success: true,
    subscriptionId: subscription.id,
  });
});

export const paymentVerification = catchAsyncError(async (req, res, next) => {
  const { razorpay_signature, razorpay_payment_id, razorpay_subscription_id } =
    req.body;

  const user = await User.findById(req.user._id);

  const subscription_id = user.subscription.id;

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_API_SECRET)
    .update(razorpay_payment_id + "|" + subscription_id, "utf-8")
    .digest("hex");

  const isAuthentic = generated_signature === razorpay_signature;

  if (!isAuthentic)
    return res.redirect(`${process.env.FRONTEND_URL}/paymentfail`);

  // database comes here
  await Payment.create({
    razorpay_signature,
    razorpay_payment_id,
    razorpay_subscription_id,
  });

  user.subscription.status = "active";

  await user.save();

  res.redirect(
    `${process.env.FRONTEND_URL}/paymentsuccess?reference=${razorpay_payment_id}`
  );
});

export const getRazorPayKey = catchAsyncError(async (req, res, next) => {
  res.status(200).json({
    success: true,
    key: process.env.RAZORPAY_API_KEY,
  });
});

export const cancelSubscription = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  const subscriptionId = user.subscription.id;
  let refund = false;

  await instance.subscriptions.cancel(subscriptionId);

  const payment = await Payment.findOne({
    razorpay_subscription_id: subscriptionId,
  });

  const gap = Date.now() - payment.createdAt;

  const refundTime = process.env.REFUND_DAYS * 24 * 60 * 60 * 1000;

  if (refundTime > gap) {
    await instance.payments.refund(payment.razorpay_payment_id);
    refund = true;
  }

  await payment.remove();
  user.subscription.id = undefined;
  user.subscription.status = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: refund
      ? "Subscription cancelled, You will receive full refund within 7 days."
      : "Subscription cancelled, Now refund initiated as subscription was cancelled after 7 days.",
  });
});

export const getPaymentByUser = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", field = "name" } = req.query;
    const paymentInformation = await User.find(
      {
        [field]: new RegExp(search),
        role: "user",
      },
      {
        name: 1,
        email: 1,
        subscription: 1,
      },
      {
        limit: limit,
        skip: (page - 1) * limit,
      }
    ).sort("name");

    res.status(200).json({
      success: true,
      message: Message.SUCCESS,
      data: {
        paymentInformation,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error.message,
    });
  }
};

export const activate = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    user.subscription.status = "active";
    user.subscription.id = uuidv4();
    await user.save();

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

export const deactivate = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    user.subscription.status = "created";
    await user.save();

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

export const sendmomo = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.params.userId);
  if (!user) {
    return next(new ErrorHandler("User not Found"), 404);
  }
  if (user.subscription && user.subscription.status === "active") {
    return next(new ErrorHandler("User has been paid", 403));
  }

  var partnerCode = "MOMO";
  var accessKey = process.env.MOMO_ACCESSKEY;
  var secretkey = process.env.MOMO_SECRETKEY;
  var requestId = partnerCode + new Date().getTime();
  var orderId = requestId;
  var orderInfo = "Register to be Premium User !"; // name: ten hoa don
  var redirectUrl = `${process.env.URL_WEBSITE}/api/v1/pay/momo/success`;
  var ipnUrl = `${process.env.URL_WEBSITE}/api/v1/pay/momo/success`;
  // var ipnUrl = redirectUrl = "https://webhook.site/454e7b77-f177-4ece-8236-ddf1c26ba7f8";
  var amount = 299 * 23;
  var requestType = "captureWallet";
  var extraData = req.params.userId; //pass empty value if your merchant does not have stores
  //before sign HMAC SHA256 with format
  //accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType
  var rawSignature =
    "accessKey=" +
    accessKey +
    "&amount=" +
    amount +
    "&extraData=" +
    extraData +
    "&ipnUrl=" +
    ipnUrl +
    "&orderId=" +
    orderId +
    "&orderInfo=" +
    orderInfo +
    "&partnerCode=" +
    partnerCode +
    "&redirectUrl=" +
    redirectUrl +
    "&requestId=" +
    requestId +
    "&requestType=" +
    requestType;

  var signature = crypto
    .createHmac("sha256", secretkey)
    .update(rawSignature)
    .digest("hex");

  const requestBody = JSON.stringify({
    partnerCode: partnerCode,
    accessKey: accessKey,
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    redirectUrl: redirectUrl,
    ipnUrl: ipnUrl,
    extraData: extraData,
    requestType: requestType,
    signature: signature,
    lang: "en",
  });

  const options = {
    hostname: "test-payment.momo.vn",
    port: 443,
    path: "/v2/gateway/api/create",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestBody),
    },
  };

  const momoRequest = (options, requestBody, res) => {
    let bodyRequest = "";
    const request = https.request(options, (response) => {
      console.log(`Status: ${response.statusCode}`);
      console.log(`Headers: ${JSON.stringify(response.headers)}`);
      response.setEncoding("utf8");
      response.on("data", (body) => {
        bodyRequest += body;
      });
      console.log(bodyRequest);
      response.on("end", () => {
        console.log("No more data in response.");
        console.log(JSON.parse(bodyRequest).payUrl);
        res.redirect(JSON.parse(bodyRequest).payUrl);
      });
    });
    request.on("error", (e) => {
      console.log(`problem with request: ${e.message}`);
    });
    // write data to request body
    console.log("Sending....");
    request.write(requestBody);
    request.end();
  };

  await momoRequest(options, requestBody, res);
});

export const momoSuccess = catchAsyncError(async (req, res, next) => {
  const { extraData } = req.query; // extraData : userID
  console.log(extraData);
  await User.findByIdAndUpdate(extraData, {
    subscription: {
      id: uuidv4().toString(),
      status: "active",
    },
  });

  res.redirect("http://localhost:3000/courses");
});

export const sendVNPay = catchAsyncError(async (req, res, next) => {
  const user = await User.findById(req.params.userId);
  try {
    if (!user) {
      return next(new ErrorHandler("User not Found"), 404);
    }
    if (user.subscription.status === "active") {
      return next(new ErrorHandler("User has been paid", 403));
    }
  } catch (e) {
    return next(new ErrorHandler(e, 400));
  }

  const sortObject = (obj) => {
    var sorted = {};
    var str = [];
    var key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  };

  var ipAddr =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  var tmnCode = process.env.VNP_TMNCODE;
  var secretKey = process.env.VNP_HASHSECRET;
  var vnpUrl = process.env.VNP_URL;
  var returnUrl = `${process.env.URL_WEBSITE}/api/v1/pay/vnpay/success`;

  var date = new Date();

  var createDate = dateFormat(date, "yyyymmddHHMMss");
  var orderId = dateFormat(date, "HHmmss");
  var amount = 299 * 23000;
  var bankCode = "";

  var orderInfo = "payment for premium";
  var orderType = "billpayment";
  var locale = "vn";
  if (locale === null || locale === "") {
    locale = "vn";
  }
  var currCode = "VND";
  var vnp_Params = {};

  vnp_Params["vnp_Version"] = "2.1.0";
  vnp_Params["vnp_Command"] = "pay";
  vnp_Params["vnp_TmnCode"] = tmnCode;
  // vnp_Params["vnp_Merchant"] = req.body.orderId;
  vnp_Params["vnp_Locale"] = locale;
  vnp_Params["vnp_CurrCode"] = currCode;
  vnp_Params["vnp_TxnRef"] = orderId;
  vnp_Params["vnp_OrderInfo"] = orderInfo + "," + user._id;
  vnp_Params["vnp_OrderType"] = orderType;
  vnp_Params["vnp_Amount"] = amount * 100;
  vnp_Params["vnp_ReturnUrl"] = returnUrl;
  vnp_Params["vnp_IpAddr"] = ipAddr;
  vnp_Params["vnp_CreateDate"] = createDate;
  // vnp_Params["vnp_idOrder"] = req.body.orderId;
  if (bankCode !== null && bankCode !== "") {
    vnp_Params["vnp_BankCode"] = bankCode;
  }

  vnp_Params = sortObject(vnp_Params);

  var signData = querystring.stringify(vnp_Params, { encode: false });

  var hmac = crypto.createHmac("sha512", secretKey);

  var signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  vnp_Params["vnp_SecureHash"] = signed;

  vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });
  console.log(vnpUrl);
  res.redirect(vnpUrl);
});

export const VNPAYsuccess = catchAsyncError(async (req, res, next) => {
  const sortObject = (obj) => {
    var sorted = {};
    var str = [];
    var key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  };
  var vnp_Params = req.query;

  var secureHash = vnp_Params["vnp_SecureHash"];

  delete vnp_Params["vnp_SecureHash"];
  delete vnp_Params["vnp_SecureHashType"];

  vnp_Params = sortObject(vnp_Params);

  var tmnCode = process.env.VNP_TMNCODE;
  var secretKey = process.env.VNP_HASHSECRET;

  var signData = querystring.stringify(vnp_Params, { encode: false });
  var hmac = crypto.createHmac("sha512", secretKey);
  var signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  if (secureHash === signed) {
    //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua
    const userId = req.query.vnp_OrderInfo.split(",")[1];
    await User.findByIdAndUpdate(userId, {
      subscription: {
        id: uuidv4().toString(),
        status: "active",
      },
    });
    // res.render("success", { code: vnp_Params["vnp_ResponseCode"] });
    res.redirect("http://localhost:3000/courses");
    // res.json({
    //    success: "success",
    //    code: { code: vnp_Params["vnp_ResponseCode"] },
    //    data: req.query,
    //    order,
    // });
  } else {
    res.render("success", { code: "97" });
  }
});
