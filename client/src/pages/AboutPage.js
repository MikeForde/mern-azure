import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';

function AboutPage() {
    return (
        <Container className="mt-5">
            <Row>
                <Col>
                    <h3>About International Patient Summary (IPS)</h3>
                    <p>
                        The International Patient Summary (IPS) is a standardized health data format
                        designed to facilitate the exchange of patient health information across
                        different healthcare systems and countries. It aims to improve interoperability
                        and enable seamless sharing of medical records, ensuring better patient care
                        and safety.
                    </p>
                    <p>
                        IPS contains essential health information such as patient demographics, medical
                        history, medications, allergies, and more, in a structured and standardized
                        format.
                    </p>
                </Col>
            </Row>
            <Row className="mt-4">
                <Col>
                    <h3>Useful Links</h3>
                    <Card>
                        <Card.Body>
                            <Card.Title>IPS Implementation Guide</Card.Title>
                            <Card.Text>
                                Explore the IPS implementation guide for detailed information on data
                                elements, standards, and implementation best practices.
                            </Card.Text>
                            <Card.Link href="https://www.hl7.org/fhir/uv/ips/">
                                IPS Implementation Guide
                            </Card.Link>
                        </Card.Body>
                    </Card>
                    <Card>
                        <Card.Body>
                            <Card.Title>IPS Website</Card.Title>
                            <Card.Text>
                            Visit the official website of the International Patient Summary (IPS) to 
                            learn more about the standard and its implementation.
                            </Card.Text>
                            <Card.Link href="https://international-patient-summary.net">
                                IPS Website
                            </Card.Link>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default AboutPage;
