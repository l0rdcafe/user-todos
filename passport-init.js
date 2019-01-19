const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const knex = require("./db/knex-instance");
const bcrypt = require("bcrypt");

passport.use(
  "login",
  new LocalStrategy(async (username, password, done) => {
    try {
      const [user] = await knex("users")
        .select("*")
        .where("username", username);
      if (!user) {
        return done(null, false, { message: "Username not found." });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (isValidPassword) {
        return done(null, user);
      }
      return done(null, false, { message: "Invalid password." });
    } catch (e) {
      console.log(e);
      done(null, false, { message: "Authentication failed." });
    }
  })
);

module.exports = function() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [user] = await knex("users")
        .select("*")
        .where("id", id);
      done(null, user);
    } catch (e) {
      console.log(e);
      done(e, false);
    }
  });
};
