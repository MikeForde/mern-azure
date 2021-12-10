require("dotenv").config();
const express = require("express");
const ReadPreference = require("mongodb").ReadPreference;
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const { DB_CONN } = process.env;

const api = express();
api.use(cors()); // enable CORS on all our requests
api.use(express.json()); // parses incoming requests with JSON payloads
api.use(express.urlencoded({ extended: false })); // parses incoming requests with urlencoded payloads

mongoose
    .connect(DB_CONN, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("DB connection successful"))
    .catch(console.error);

const ToDoModel = mongoose.model(
    "todo",
    new mongoose.Schema({
        isDone: Boolean,
        text: String,
    })
);

api.get("/todo/all", (req, res) => {
    ToDoModel.find({})
        .read(ReadPreference.NEAREST)
        .exec()
        .then((todos) => {
            res.json(todos);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

api.post("/todo", (req, res) => {
    const { todo } = req.body;

    todo._id = new mongoose.Types.ObjectId();
    const newTodo = new ToDoModel(todo);

    newTodo
        .save()
        .then((newTodo) => {
            res.json(newTodo);
        })
        .catch((err) => {
            res.status(400).send(err);
        });
});

api.put("/todo/:id", (req, res) => {
    const { id } = req.params;

    if (id) {
        ToDoModel.findById(id)
            .read(ReadPreference.NEAREST)
            .exec()
            .then((todo) => {
                todo.isDone = !todo.isDone;
                todo.save().then((updatedTodo) => {
                    res.json(updatedTodo);
                });
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    } else {
        res.status(404).send("ToDo not found.");
    }
});

api.delete("/todo/:id", (req, res) => {
    const { id } = req.params;

    if (id) {
        ToDoModel.findByIdAndRemove(id)
            .then((todo) => {
                res.json(todo._id);
            })
            .catch((err) => {
                res.status(400).send(err);
            });
    }
});

api.use(express.static(path.join(__dirname, "client", "build")));
api.get("/*", (req, res) => {
    res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

const port = process.env.PORT || 5000;
api.listen(port);