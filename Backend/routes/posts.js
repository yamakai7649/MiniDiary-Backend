const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const CustomError = require("../CustomError");
const isLoggedIn = require("../middleware/isLoggedIn");

const attachUsers = async (posts) => {
  const postDocs = posts.filter(Boolean).map((post) => post._doc || post);
  const userIds = [...new Set(postDocs.map((post) => post.userId).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).select("-password -updatedAt");
  const userMap = Object.fromEntries(
    users.map((user) => [user._id.toString(), { ...user._doc }])
  );

  return postDocs.map((post) => ({ ...post, user: userMap[post.userId] || null }));
};

//投稿を作成する
router.post("/", isLoggedIn, async (req, res, next) => {
  try {
    const post = new Post({ ...req.body, userId: req.session.user.id });
    await post.save();
    const user = await User.findById(req.session.user.id).select("-password -updatedAt");
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    return res.status(200).json({ ...post._doc, user: user._doc });
  } catch (err) {
    return next(err);
  }
});

//すべての投稿を取得
router.get("/timeline", async (req, res, next) => {
  try {
    const posts = await Post.find();
    return res.status(200).json(await attachUsers(posts));
  } catch (err) {
    return next(err);
  }
});

//いいねした投稿を取得
router.get("/like", async (req, res, next) => {
  try {
    const { username } = req.query;
    const user = await User.findOne({ username });
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));
    const posts = await Post.find({ likes: { $in: [user._id.toHexString()] } });
    return res.status(200).json(await attachUsers(posts));
  } catch (err) {
    return next(err);
  }
});

//投稿を編集する
router.put("/:id", isLoggedIn, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new CustomError("投稿が見つかりません", 404));

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
    if (!post) return next(new CustomError("投稿が見つかりません", 404));

    if (post.userId !== req.session.user.id.toString()) {
      return next(new CustomError("投稿を削除する権限がありません", 403));
    }

    const deletedComments = await Promise.all(
      post.comments.map((commentId) => Comment.findByIdAndDelete(commentId))
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
    if (!post) return next(new CustomError("投稿が見つかりません", 404));

    const [postWithUser] = await attachUsers([post]);
    return res.status(200).json(postWithUser);
  } catch (err) {
    return next(err);
  }
});

//投稿にいいねをする
router.put("/:id/like", isLoggedIn, async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return next(new CustomError("投稿が見つかりません", 404));

    const userId = req.session.user.id.toString();

    if (post.likes.includes(userId)) {
      await post.updateOne({ $pull: { likes: userId } });
      return res.status(200).send("いいねを外しました");
    }

    await post.updateOne({ $push: { likes: userId } });
    const user = await User.findById(userId);
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

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
    if (req.params.userId !== req.session.user.id.toString()) {
      return next(new CustomError("タイムラインを取得する権限がありません", 403));
    }

    const currentUser = await User.findById(req.session.user.id);
    if (!currentUser) return next(new CustomError("ユーザーが見つかりません", 404));

    const currentUserPosts = await Post.find({ userId: currentUser._id });
    const friendPosts = await Promise.all(
      currentUser.followings.map((friendId) => Post.find({ userId: friendId }))
    );
    const timelinePosts = currentUserPosts.concat(...friendPosts);
    return res.status(200).json(await attachUsers(timelinePosts));
  } catch (err) {
    return next(err);
  }
});

//プロフィールの投稿を取得
router.get("/profile/:username", async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return next(new CustomError("ユーザーが見つかりません", 404));

    const userPosts = await Post.find({ userId: user._id });
    return res.status(200).json(await attachUsers(userPosts));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
