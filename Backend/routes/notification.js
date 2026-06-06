const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const CustomError = require("../CustomError");
const isLoggedIn = require("../middleware/isLoggedIn");

//通知の取得
router.get("/", isLoggedIn, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.session.user.id });

    return res.status(200).json(notifications);
  } catch (err) {
    return next(err);
  }
});

//通知の削除
router.delete("/", isLoggedIn, async (req, res, next) => {
  try {
    const { notificationId } = req.query;
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return next(new CustomError("通知が見つかりません", 404));
    }

    if (notification.userId.toString() !== req.session.user.id.toString()) {
      return next(new CustomError("通知を削除する権限がありません", 403));
    }

    const deletedNotification = await notification.deleteOne();

    return res.status(200).json(deletedNotification);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
