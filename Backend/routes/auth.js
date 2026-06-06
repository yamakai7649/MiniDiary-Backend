const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { hashPassword, verifyPassword } = require("../hashPassword");
const CustomError = require("../CustomError");
const isProduction = process.env.NODE_ENV === "production";

//ユーザー登録
router.post("/register", async (req, res, next) => {
  try {
    const { password, username } = req.body;
    const hashedPassword = await hashPassword(password);
    const newUser = new User({ username, password: hashedPassword });
    const user = await newUser.save();
    const { password: _, ...others } = user._doc;

    return res.status(200).json(others);
  } catch (err) {
    return next(err);
  }
});

//ログイン
router.post("/login", async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user) {
      return next(new CustomError("ユーザーが存在しません", 400));
    }

    const isMatch = await verifyPassword(req.body.password, user.password);

    if (!isMatch) {
      return next(new CustomError("パスワードが違います", 400));
    }

    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.user = { id: user._id };

      req.session.save((err) => {
        if (err) return next(err);

        const { password: _, ...others } = user._doc;
        return res.status(200).json(others);
      });
    });
  } catch (err) {
    return next(err);
  }
});

//ログアウト
router.post("/logout", async (req, res, next) => {
  try {
    req.session.destroy((err) => {
      if (err) return next(err);

      res.clearCookie("connect.sid", {
        path: "/",
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? "strict" : "lax",
      });

      return res.status(200).json({ message: "ログアウトしました" });
    });
  } catch (err) {
    return next(err);
  }
});

//ユーザーの検証
router.get("/", async (req, res, next) => {
  try {
    const { username } = req.query;
    const user = await User.find({ username });

    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
});

//セッションからユーザーを取得
router.get("/user", async (req, res, next) => {
  try {
    if (!req.session.user) return res.status(200).json(null);

    const { id } = req.session.user;
    const user = await User.findById(id);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(200).json(null);
    }

    const { password: _, ...others } = user._doc;

    return res.status(200).json(others);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
