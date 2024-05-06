import React, { useEffect, useState } from "react";
import "./HomePage.css";
import { Card } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";
import { FormIPS } from "./Components/FormIPS";
import { IPS } from "./Components/IPS";

const server = process.env.REACT_APP_API_BASE_URL
  ? axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL })
  : axios.create({});

function HomePage() {
  const [ipss, setIPS] = useState([]);

  const add = (formData) => {
    // Remove medication array entries with blank values for all three items
    const cleanedMedication = formData.medication.filter(item => {
      return item.name.trim() !== "" || item.date.trim() !== "" || item.dosage.trim() !== "";
    });
  
    // Remove allergies array entries with blank values for all three items
    const cleanedAllergies = formData.allergies.filter(item => {
      return item.name.trim() !== "" || item.severity.trim() !== "" || item.date.trim() !== "";
    });
  
    // Create a new formData object with cleaned medication and allergies arrays
    const cleanedFormData = {
      ...formData,
      medication: cleanedMedication,
      allergies: cleanedAllergies
    };
  
    console.log("Form Data", cleanedFormData);
    console.log(JSON.stringify(cleanedFormData, null, 2));
  
    server
      .post("/ips", cleanedFormData)
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
        <FormIPS add={add} />
        <h3> </h3>
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

export default HomePage;
