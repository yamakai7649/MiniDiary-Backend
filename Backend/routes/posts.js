const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const CustomError = require("../CustomError");
const isLoggedIn = require("../middleware/isLoggedIn");

//投稿を作成する
router.post("/", isLoggedIn, async (req, res, next) => {
  try {
    const post = new Post({ ...req.body, userId: req.session.user.id });
    await post.save();

    return res.status(200).json(post);
  } catch (err) {
    return next(err);
  }
});

//すべての投稿を取得
router.get("/timeline", async (req, res, next) => {
  try {
    const posts = await Post.find();

    return res.status(200).json(posts);
  } catch (err) {
    return next(err);
  }
});

//いいねした投稿を取得
router.get("/like", async (req, res, next) => {
  try {
    const { username } = req.query;
    const user = await User.findOne({ username });
    const posts = await Post.find({
      likes: {
        $in: [user._id.toHexString()],
      },
    });

    return res.status(200).json(posts);
  } catch (err) {
    return next(err);
  }
});

//投稿を編集する
router.put("/:id", isLoggedIn, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (post.userId !== req.session.user.id.toString()) {
      return next(new CustomError("投稿を編集する権限がありません", 403));
    }

    const updatedPost = await post.updateOne(req.body);

    return res.status(200).json(updatedPost);
  } catch (err) {
    return next(err);
  }
});

//投稿を削除する
router.delete("/:id", isLoggedIn, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (post.userId !== req.session.user.id.toString()) {
      return next(new CustomError("投稿を削除する権限がありません", 403));
    }

    const deletedComments = await Promise.all(
      post.comments.map((commentId) => {
        return Comment.findByIdAndDelete(commentId);
      })
    );
    const deletedPost = await post.deleteOne();

    return res.status(200).json([deletedPost, deletedComments]);
  } catch (err) {
    return next(err);
  }
});

//特定の投稿を取得する
router.get("/:id", async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    return res.status(200).json(post);
  } catch (err) {
    return next(err);
  }
});

//投稿にいいねをする
router.put("/:id/like", isLoggedIn, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (post.likes.includes(req.body.userId)) {
      await post.updateOne({
        $pull: { likes: req.body.userId },
      });

      return res.status(200).send("いいねを外しました");
    }

    await post.updateOne({
      $push: { likes: req.body.userId },
    });

    const user = await User.findById(req.body.userId);
    const notification = new Notification({
      userId: post.userId,
      type: "like",
      content: `${user.username}さんがあなたの日記にいいねをしました！`,
      postId: post._id,
    });
    await notification.save();

    return res.status(200).send("いいねをしました");
  } catch (err) {
    return next(err);
  }
});

//フォロータイムラインの投稿を取得
router.get("/following/:userId", isLoggedIn, async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.params.userId);
    const currentUserPosts = await Post.find({ userId: currentUser._id });
    const friendPosts = await Promise.all(
      currentUser.followings.map((friendId) => {
        return Post.find({ userId: friendId });
      })
    );
    const timelinePosts = currentUserPosts.concat(...friendPosts);

    return res.status(200).json(timelinePosts);
  } catch (err) {
    return next(err);
  }
});

//プロフィールの投稿を取得
router.get("/profile/:username", async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    const userPosts = await Post.find({ userId: user._id });

    return res.status(200).json(userPosts);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
