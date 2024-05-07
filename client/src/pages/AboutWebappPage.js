import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';

function AboutWebAppPage() {
    return (
        <Container className="mt-5">
            <Row>
                <Col>
                    <h2>About This Web Application</h2>
                    <p>
                        Built using the MERN stack. MERN stands for MongoDB, Express.js, React, and Node.js.
                    </p>
                </Col>
            </Row>
            <Row className="mt-4">
                <Col>
                    <h3>Development Pipeline</h3>
                    <Card>
                        <Card.Body>
                            <Card.Text>
                                The development pipeline involves the following steps:
                                <ol>
                                    <li>Development Environment: Linux ubuntu-like distribution (Bodhi) running on a virtual machine (VM).</li>
                                    <li>Version Control: GitHub.</li>
                                    <li>Continuous Deployment: GitHub Actions, which automates the deployment process whenever changes are pushed to the GitHub repository.</li>
                                    <li>Hosting: The application is hosted on Microsoft Azure.</li>
                                </ol>
                            </Card.Text>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <Row className="mt-4">
                <Col>
                    <h3>Installation Options</h3>
                    <Card>
                        <Card.Body>
                            <Card.Text>
                                This web application can be ported easily to a closed network, and stood-up via standalone Linux, virtual machine (VM), or Docker.
                            </Card.Text>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <Row className="mt-4">
                <Col>
                    <h3>Future Development and Experimentation</h3>
                    <Card>
                        <Card.Body>
                            <Card.Text>
                                Many features of this prototype web application are designed for demonstration and experimentation. Certain aspects would therefore either not be included or implemented in the same manner in a production-ready version. Feedback and ideas are always welcome.
                            </Card.Text>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default AboutWebAppPage;