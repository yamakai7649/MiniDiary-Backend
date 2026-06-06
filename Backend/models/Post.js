const mongoose = require("mongoose");
const { Schema } = mongoose;

const postSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      maxlength: 500,
    },
    img: {
      type: String,
    },
    imgId: {
      type: String,
    },
    likes: {
      type: Array,
      default: [],
    },
    comments: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
