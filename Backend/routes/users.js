const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const CustomError = require("../CustomError");
const isLoggedIn = require("../middleware/isLoggedIn");

//おすすめのユーザーを取得
router.get("/recommendation", async (req, res, next) => {
  try {
    const { username } = req.query;
    const users = await User.aggregate([
      { $match: { username: { $ne: username } } },
      { $sample: { size: 10 } },
    ]);

    return res.status(200).json(users);
  } catch (err) {
    return next(err);
  }
});

//ユーザーの更新
router.put("/:id", isLoggedIn, async (req, res, next) => {
  try {
    if (req.params.id !== req.session.user.id.toString()) {
      return next(new CustomError("ユーザーを更新する権限がありません", 403));
    }

    const { desc, profilePicture, profilePictureId, username } = req.body;
    const updates = {};
    if (desc !== undefined) updates.desc = desc;
    if (profilePicture !== undefined) updates.profilePicture = profilePicture;
    if (profilePictureId !== undefined) updates.profilePictureId = profilePictureId;
    if (username !== undefined) updates.username = username;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const { password: _, ...others } = user._doc;

    return res.status(200).json(others);
  } catch (err) {
    if (err.name === "ValidationError") {
      return next(new CustomError("ユーザー名は4文字以上、15文字以内で入力してください", 400));
    }
    if (err.code === 11000 && err.keyPattern?.username) {
      return next(new CustomError("そのユーザー名はすでに使われています", 409));
    }
    return next(err);
  }
});

//ユーザーの削除
router.delete("/", isLoggedIn, async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const posts = await Post.find({ userId });

    await Promise.all(
      posts.map((post) => {
        return Promise.all(
          post.comments.map((commentId) => {
            return Comment.findByIdAndDelete(commentId);
          })
        );
      })
    );

    await Post.deleteMany({ userId });
    await Comment.deleteMany({ userId });
    await Notification.deleteMany({ userId });

    const user = await User.findByIdAndDelete(userId);

    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
});

//ユーザーをクエリで取得
router.get("/", async (req, res, next) => {
  try {
    const { username, userId } = req.query;
    const user = userId
      ? await User.findById(userId)
      : await User.findOne({ username });

    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const { password, updatedAt, ...others } = user._doc;

    return res.status(200).json(others);
  } catch (err) {
    return next(err);
  }
});

//ユーザーのフォロー
router.put("/:username/follow", isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const currentUser = await User.findById(req.session.user.id);
    if (!currentUser) return next(new CustomError("ログインユーザーが見つかりません", 404));

    if (currentUser.id === user.id) {
      return next(new CustomError("自分のことをフォローすることはできません", 400));
    }

    if (currentUser.followings.includes(user.id)) {
      return next(new CustomError("そのユーザーはすでにフォロー済みです", 409));
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentUser.id,
      { $push: { followings: user.id } },
      { new: true }
    );
    await User.findByIdAndUpdate(user.id, {
      $push: { followers: currentUser.id },
    });

    const notification = new Notification({
      userId: user._id,
      type: "follow",
      content: `${currentUser.username}さんがあなたのことをフォローしました！`,
      usernameOfFollower: currentUser.username,
    });
    await notification.save();

    return res.status(200).json(updatedUser);
  } catch (err) {
    return next(err);
  }
});

//ユーザーのフォローを外す
router.put("/:username/unfollow", isLoggedIn, async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const currentUser = await User.findById(req.session.user.id);
    if (!currentUser) return next(new CustomError("ログインユーザーが見つかりません", 404));

    if (currentUser.id === user.id) {
      return next(new CustomError("自分のことをフォロー解除することはできません", 400));
    }

    if (!currentUser.followings.includes(user.id)) {
      return next(new CustomError("そのユーザーはまだフォローしていません", 409));
    }

    const updatedUser = await User.findByIdAndUpdate(
      currentUser.id,
      { $pull: { followings: user.id } },
      { new: true }
    );
    await User.findByIdAndUpdate(user.id, {
      $pull: { followers: currentUser.id },
    });

    return res.status(200).json(updatedUser);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
