const CustomError = require("../CustomError");

module.exports = (req, res, next) => {
    if (!req.session.user) {
        return next(new CustomError("ログインが必要です", 401));
    }
    next();
};
