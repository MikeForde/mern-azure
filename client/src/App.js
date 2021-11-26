import React, { useEffect } from "react";
import "./App.css";
import { Button, Card, Form } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";

const server = process.env.REACT_APP_API_BASE_URL
  ? axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })
  : axios.create({});

function Todo({ todo, changeStatus, remove }) {
  return (
    <div className="todo">
      <span style={{ textDecoration: todo.isDone ? "line-through" : "" }}>
        {todo.text}
      </span>
      <div>
        <Button
          variant={todo.isDone ? "outline-warning" : "outline-success"}
          onClick={() => changeStatus(todo._id)}
        >
          {todo.isDone ? "✕" : "✓"}
        </Button>{" "}
        <Button variant="outline-danger" onClick={() => remove(todo._id)}>
          🗑️
        </Button>
      </div>
    </div>
  );
}

function FormTodo({ add }) {
  const [value, setValue] = React.useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value) return;
    add(value);
    setValue("");
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Form.Group>
        <Form.Label>
          <b>Add Todo</b>
        </Form.Label>
        <Form.Control
          type="text"
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add new todo"
        />
      </Form.Group>
      <Button className="submit" variant="primary mb-3" type="submit">
        Submit
      </Button>
    </Form>
  );
}

function App() {
  const [todos, setTodos] = React.useState([]);

  const add = (todo) => {
    server
      .post("/todo", {
        todo: {
          text: todo,
          isDone: false,
        },
      })
      .then((response) => {
        return response.data;
      })
      .then((createdTodo) => {
        if (createdTodo) {
          const newTodos = [...todos, createdTodo];
          setTodos(newTodos);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const changeStatus = (id) => {
    server
      .put(`/todo/${id}`)
      .then((response) => {
        return response.data;
      })
      .then((editedTodo) => {
        if (editedTodo) {
          const newTodos = [...todos];

          let index = newTodos.findIndex((c) => c._id === editedTodo._id);
          if (index !== -1) {
            newTodos[index] = editedTodo;
            setTodos(newTodos);
          }
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const remove = (id) => {
    server
      .delete(`/todo/${id}`)
      .then((response) => {
        return response.data;
      })
      .then((removedId) => {
        const newTodos = [...todos];

        let index = todos.findIndex((c) => c._id === removedId);
        if (index !== -1) {
          newTodos.splice(index, 1);
          setTodos(newTodos);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const getAll = () => {
    server
      .get("/todo/all")
      .then((response) => {
        return response.data;
      })
      .then((todos) => {
        if (todos) {
          setTodos(todos);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  useEffect(() => {
    getAll();
  }, []);

  return (
    <div className="app">
      <div className="container">
        <h1 className="text-center mb-4">Todo List with MERN on Github+Azure</h1>
        <FormTodo add={add} />
        <div>
          {todos.map((todo) => (
            <Card key={todo._id}>
              <Card.Body>
                <Todo todo={todo} changeStatus={changeStatus} remove={remove} />
              </Card.Body>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
