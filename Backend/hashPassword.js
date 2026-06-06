const bcrypt = require("bcrypt");

const saltRounds = 8;

const hashPassword = async (password) => {
  return bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

module.exports = { hashPassword, verifyPassword };
