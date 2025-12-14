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
                    <h3>About NATO Patient Summary (NPS)</h3>
                    <p>
                        The NATO Patient Summary (NPS) builds directly on the International Patient Summary (IPS)
                        specification, reusing the same core clinical concepts, data structures, and interoperability
                        principles defined by HL7 FHIR. Its primary goal is to ensure that essential patient information
                        can be safely and consistently exchanged in multinational, coalition, and operational
                        healthcare environments.
                    </p>
                    <p>
                        Like IPS, the NPS focuses on a concise, clinically relevant subset of a patient record,
                        including demographics, allergies, medications, problems, procedures, and immunisations.
                        This alignment ensures that systems capable of producing or consuming IPS data can, in
                        many cases, also work with NPS content with minimal transformation.
                    </p>
                    <p>
                        Where NPS differs from standard IPS is in its operational context and constraints.
                        NPS places additional emphasis on deployability, offline use, data compactness, and
                        controlled write access, reflecting military and humanitarian scenarios such as
                        deployed medical facilities, field care, and cross-nation handover. Profiles,
                        terminology bindings, and transport mechanisms may be more tightly constrained to
                        ensure predictable behaviour across diverse systems and partners.
                    </p>
                    <p>
                        In practice, NPS can be viewed as a defence-focused, operationally constrained
                        application of IPS rather than a competing standard — prioritising interoperability,
                        trust, and resilience in environments where connectivity, infrastructure, and
                        governance models differ from civilian healthcare.
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
