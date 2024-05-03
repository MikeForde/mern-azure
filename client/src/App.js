import React, { useEffect, useState } from "react";
import "./App.css";
import { Card } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { FormIPS } from "./Components/FormIPS";
import { IPS } from "./Components/IPS";

const server = process.env.REACT_APP_API_BASE_URL
  ? axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })
  : axios.create({});

function App() {
  const [ipss, setIPS] = useState([]);

  const add = (formData) => {
    console.log(JSON.stringify(formData, null, 2));
    server
      .post("/ips", formData)
      .then((response) => {
        return response.data;
      })
      .then((createdIPS) => {
        if (createdIPS) {
          const newIPS = [...ipss, createdIPS];
          setIPS(newIPS);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const remove = (id) => {
    server
      .delete(`/ips/${id}`)
      .then((response) => {
        return response.data;
      })
      .then((removedId) => {
        const newIPS = [...ipss];

        let index = ipss.findIndex((c) => c._id === removedId);
        if (index !== -1) {
          newIPS.splice(index, 1);
          setIPS(newIPS);
        }
      })
      .catch((error) => {
        console.log("Error", error);
      });
  };

  const getAll = () => {
    server
      .get("/ips/all")
      .then((response) => {
        return response.data;
      })
      .then((ipss) => {
        if (ipss) {
          setIPS(ipss);
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
        <h1 className="text-center mb-4">IPS MERN Prototype v0_2</h1>
        <FormIPS add={add} />
        <div>
          {ipss.map((ips) => (
            <Card key={ips._id}>
              <Card.Body>
                <IPS ips={ips} remove={remove} />
              </Card.Body>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
