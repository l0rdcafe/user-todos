const express = require("express");
const morgan = require("morgan")("short");
const path = require("path");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const createError = require("http-errors");
const session = require("express-session");
const uuidv1 = require("uuid/v1");

const routes = require("./routes");
require("dotenv").config();

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(helmet());
app.use(morgan);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    secret: uuidv1(),
    resave: true,
    saveUninitialized: true
  })
);
app.use(routes);

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500).render("error");
  next();
});

app.listen(process.env.PORT);
