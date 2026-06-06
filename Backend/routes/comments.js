const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const User = require("../models/User");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const CustomError = require("../CustomError");
const isLoggedIn = require("../middleware/isLoggedIn");

//コメントを作成する
router.post("/:postId", isLoggedIn, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return next(new CustomError("投稿が見つかりません", 404));

    const comment = new Comment({ ...req.body, userId: req.session.user.id });
    await comment.save();
    await post.updateOne({
      $push: { comments: comment._id },
    });

    const user = await User.findById(comment.userId);
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const notification = new Notification({
      userId: post.userId,
      content: `${user.username}さんがあなたの日記にコメントをしました！`,
      type: "comment",
      postId: post._id,
    });
    await notification.save();

    const commentUser = await User.findById(comment.userId).select("-password -updatedAt");
    return res.status(200).json({ ...comment._doc, user: commentUser._doc });
  } catch (err) {
    return next(err);
  }
});

//コメントを削除する
router.delete("/:id", isLoggedIn, async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return next(new CustomError("コメントが見つかりません", 404));

    const post = await Post.findOne({ comments: comment._id });
    const sessionUserId = req.session.user.id.toString();
    const isCommentOwner = comment.userId === sessionUserId;
    const isPostOwner = post && post.userId === sessionUserId;

    if (!isCommentOwner && !isPostOwner) {
      return next(new CustomError("コメントを削除する権限がありません", 403));
    }

    const deletedComment = await comment.deleteOne();
    if (post) {
      await post.updateOne({
        $pull: { comments: comment._id },
      });
    }

    return res.status(200).json(deletedComment);
  } catch (err) {
    return next(err);
  }
});

//特定のコメントを取得する
router.get("/:id", async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return next(new CustomError("コメントが見つかりません", 404));

    return res.status(200).json(comment);
  } catch (err) {
    return next(err);
  }
});

//タイムラインのコメントを取得
router.get("/timeline/:postId", async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return next(new CustomError("投稿が見つかりません", 404));

    const comments = (await Promise.all(
      post.comments.map((commentId) => Comment.findById(commentId))
    )).filter(Boolean);

    const userIds = [...new Set(comments.map((comment) => comment.userId))];
    const users = await User.find({ _id: { $in: userIds } }).select("-password -updatedAt");
    const userMap = Object.fromEntries(users.map((user) => [user._id.toString(), { ...user._doc }]));

    const commentsWithUser = comments.map((comment) => ({
      ...comment._doc,
      user: userMap[comment.userId] || null,
    }));

    return res.status(200).json(commentsWithUser);
  } catch (err) {
    return next(err);
  }
});

//プロフィールのタイムラインのコメントを取得
router.get("/profile/:username", async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const userComments = await Comment.find({ userId: user._id });

    return res.status(200).json(userComments);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
