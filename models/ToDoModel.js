const mongoose = require("mongoose");

const ToDoModel = mongoose.model(
    "todo",
    new mongoose.Schema({
        isDone: Boolean,
        text: String,
    })
);
exports.ToDoModel = ToDoModel;
