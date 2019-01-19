const { Router } = require("express");
const { body, validationResult } = require("express-validator/check");
const { sanitizeBody } = require("express-validator/filter");
const bcrypt = require("bcrypt");
const uuidv1 = require("uuid/v1");
const { promisify } = require("util");

const knex = require("../db/knex-instance");

const router = Router();

router.get("/", async (req, res, next) => {
  if (req.session.userId === undefined) {
    return res.render("index", { title: "Home" });
  }

  try {
    const [user] = await knex("users")
      .select("*")
      .where("id", req.session.userId);
    const todosResult = await knex("todos")
      .select("todo")
      .where("user_id", req.session.userId);
    const todos = todosResult.length > 0 ? [...todosResult] : [];
    console.log(todos);

    res.render("index", { title: "Home", user, todos });
  } catch (e) {
    console.log(e);
    next(e);
  }
});

router.get("/login", (req, res) => {
  res.render("login", { title: "Sign In" });
});

router.post("/login", [
  body("username", "Username must not be empty.")
    .isLength({ min: 1 })
    .trim(),
  body("password", "Password must not be empty.")
    .isLength({ min: 1 })
    .trim(),
  sanitizeBody("*")
    .trim()
    .escape(),
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("login", { title: "Sign In", errors: errors.array() });
    }

    try {
      const usernameResult = await knex("users")
        .select("*")
        .where("username", req.body.username);

      if (usernameResult.length === 0) {
        return res.render("login", { title: "Sign In", errors: [{ msg: "Username not found." }] });
      }

      const isValidPassword = await bcrypt.compare(req.body.password, usernameResult[0].password);
      if (!isValidPassword) {
        return res.render("login", { title: "Sign In", errors: [{ msg: "Incorrect Password." }] });
      }

      req.session.userId = usernameResult[0].id;
      await promisify(req.session.save);
      res.redirect("/");
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
]);

router.get("/logout", async (req, res, next) => {
  try {
    req.session.userId = undefined;
    await promisify(req.session.destroy);
    res.redirect("/");
  } catch (e) {
    console.log(e);
    next(e);
  }
});

router.get("/register", (req, res) => {
  res.render("register", { title: "Create User" });
});

router.post("/register", [
  body("username", "Username must not be empty.")
    .isLength({ min: 1 })
    .trim(),
  body("password", "Password must not be empty.").isLength({ min: 1 }),
  body("confirm_password", "Confirm Password must not be empty.")
    .isLength({ min: 1 })
    .trim(),
  sanitizeBody("*")
    .trim()
    .escape(),
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("register", { title: "Create User", errors: errors.array() });
    }

    if (req.body.password !== req.body.confirm_password) {
      return res.render("register", { title: "Create User", errors: [{ msg: "Passwords do not match." }] });
    }

    try {
      const hash = await bcrypt.hash(req.body.password, 10);
      const [id] = await knex("users")
        .insert({
          username: req.body.username,
          password: hash,
          is_admin: false
        })
        .returning("id");

      req.session.userId = id;
      await promisify(req.session.save);
      res.redirect("/");
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
]);

router.get("/users", async (req, res, next) => {
  try {
    const users = await knex("users")
      .select("*")
      .where("is_admin", false);
    res.render("users", { title: "Users", users, user: { is_admin: true } });
  } catch (e) {
    console.log(e);
    next(e);
  }
});

router.get("/users/delete/:id", async (req, res, next) => {
  try {
    await knex("users")
      .where("id", req.params.id)
      .del();
    await knex("todos")
      .where("user_id", req.params.id)
      .del();
    res.redirect("/users");
  } catch (e) {
    console.log(e);
    next(e);
  }
});

router.get("/create", async (req, res, next) => {
  if (req.session.userId) {
    try {
      const [user] = await knex("users")
        .select("*")
        .where("id", req.session.userId);
      res.render("create_todo", { title: "Create Todo", user });
    } catch (e) {
      console.log(e);
      next(e);
    }
  } else {
    const error = new Error("Unauthorized");
    error.status = 401;
    next(error);
  }
});

router.post("/create", [
  body("todo", "Todo must not be empty.")
    .isLength({ min: 1 })
    .trim(),
  sanitizeBody("*")
    .trim()
    .escape(),
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("create_todo", { title: "Create Todo", errors: errors.array() });
    }

    try {
      const todos = { id: uuidv1(), title: req.body.todo, completed: false };
      const parsedTodos = JSON.stringify(todos);
      await knex("todos").insert({
        user_id: req.session.userId,
        todo: parsedTodos
      });
      res.redirect("/");
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
]);

router.get("/delete/:id", async (req, res, next) => {
  if (req.params.id && req.session.userId) {
    try {
      const userTodos = await knex("todos")
        .select("*")
        .where("user_id", req.session.userId);
      const [item] = userTodos.filter(t => t.todo.id === req.params.id);
      const { id } = item;
      await knex("todos")
        .where("id", id)
        .del();
      res.redirect("/");
    } catch (e) {
      console.log(e);
      next(e);
    }
  } else if (!req.session.userId) {
    const error = new Error("Unauthorized");
    error.status = 401;
    next(error);
  } else {
    const error = new Error("No Todo ID provided.");
    error.status = 400;
    next(error);
  }
});

router.get("/edit/:id", async (req, res, next) => {
  if (req.params.id && req.session.userId) {
    try {
      const userTodos = await knex("todos")
        .select("*")
        .where("user_id", req.session.userId);
      const [item] = userTodos.filter(t => t.todo.id === req.params.id);
      const { id, completed, title } = item.todo;
      res.render("edit_todo", {
        title: "Edit Todo",
        todo: { id, completed, title },
        user: { is_admin: false },
        id: item.id
      });
    } catch (e) {
      console.log(e);
      next(e);
    }
  } else if (!req.session.userId) {
    const error = new Error("Unauthorized");
    error.status = 401;
    next(error);
  } else {
    const error = new Error("No Todo ID provided.");
    error.status = 400;
    next(error);
  }
});

router.post("/edit/:id", [
  body("todo", "Todo must not be empty.")
    .isLength({ min: 1 })
    .trim(),
  body("completed"),
  body("id"),
  body("todo_id"),
  sanitizeBody("*")
    .trim()
    .escape(),
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.render("edit_todo", { title: "Edit Todo", errors: errors.array() });
    }

    try {
      const todo = JSON.stringify({ id: req.body.id, title: req.body.todo, completed: req.body.completed });
      await knex("todos")
        .where("id", req.body.todo_id)
        .update({
          todo
        });
      res.redirect("/");
    } catch (e) {
      console.log(e);
      next(e);
    }
  }
]);

module.exports = router;
