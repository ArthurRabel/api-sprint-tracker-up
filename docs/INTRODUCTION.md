# Sprint-Tracker-Up API

**Sprint-Tracker-Up** is an evolutionary fork of the original **Sprint Tracker** project (IESB Bay Area). This version was rebuilt to transform a proof-of-concept into a production-grade API, focusing on processing scalability and rigorous code organization.

## Architecture: Modular Monolith

Unlike the initial version, the system adopts a **Modular Monolith** architecture. The central focus is the **separation of concerns** through isolated business domains. This ensures that the logic for Sprints, Tasks, and Users does not overlap, facilitating maintenance and the implementation of automated tests without the overhead of a distributed infrastructure.

---

## Features and Differentiators

### Core Features (Inherited from Sprint Tracker)

* **Task Management:** Granular control over activity lifecycles and workflows.
* **Multi-Provider Authentication:** Robust support for **OAuth2**, **LDAP**, and local authentication (**Email/Password**).
* **Progress Analysis:** Dashboards and progress metrics for monitoring task performance.

### "Up" Version Evolutions (Infrastructure)

* **Asynchronous Processing:** Integration of **BullMQ** with **Valkey** to handle heavy background jobs, ensuring the API remains responsive under high load.
* **Scalable Storage:** Native support for **S3 (AWS)** and **MinIO** for efficient file and attachment management.
* **Trello Migration:** Specialized parser for direct data ingestion via **Trello exported JSON**, facilitating seamless workflow transitions.

---

## Tech Stack

* **Language/Framework:** Node.js (**NestJS**) and **TypeScript**.
* **Database:** **PostgreSQL** (Relational Persistence).
* **Cache & Queues:** **Valkey** and **BullMQ**.
* **Storage:** S3 Compatible (**MinIO** / **AWS**).
* **Documentation:** **OpenAPI** (Swagger and Scalar).
