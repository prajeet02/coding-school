# **Architectural Blueprint and Technical Specifications for an Institutional Code Execution Platform**

## **Introduction and System Vision**

The pedagogical landscape of computer science education has increasingly pivoted toward interactive, browser-based environments that empower students to write, compile, and execute code without the friction of configuring localized development environments. The deployment of a specialized, closed-ecosystem coding platform specifically tailored for a single institution presents unique architectural challenges, security paradigms, and operational opportunities. By restricting access to a predefined institutional cohort, the system can leverage existing identity management infrastructure, optimize computational resource allocation, and foster a localized, highly engaged competitive programming ecosystem.

Developing the inaugural iteration (v1) of such a platform necessitates a robust foundational architecture capable of supporting complex asynchronous operations. This foundational layer must gracefully handle source code ingestion through a web-based interface, secure compilation, strictly isolated execution, and deterministic output evaluation. Furthermore, it integrates advanced Generative AI and multi-agent workflows to dynamically generate, validate, and provision a mathematically sound repository of coding challenges without human bottlenecks. This report delineates an exhaustive architectural blueprint for constructing an institutional online judge, focusing extensively on identity verification tailored to Galgotias University, sandboxed code execution, AI-driven content generation, and relational data modeling.

## **Institutional Identity Management and Access Control**

A paramount requirement for an institutional platform is ensuring that the ecosystem remains hermetically sealed, permitting access strictly to currently enrolled students. This mandates a stringent authentication gateway that maps digital identities to verifiable institutional records, preventing external actors from consuming computational resources or accessing proprietary problem sets.

### **Institutional Email Verification and Domain Constraints**

The primary mechanism for establishing student identity securely relies on the institution's official email domain infrastructure. An analysis of the digital identity patterns at Galgotias University reveals specific formatting conventions utilized for student email provisioning. The domain galgotiasuniversity.edu.in serves as the primary identifier, with the institutional infrastructure predominantly operating on a Gmail-based ecosystem.

The distribution of email address formats follows established nomenclatures, which must be systematically accounted for when designing regular expressions for the registration validation pipeline.

| Format Structure | Pattern Example | Prevalence |
| :--- | :--- | :--- |
| First.Last | John.Doe@galgotiasuniversity.edu.in | 92% |
| First Only | John@galgotiasuniversity.edu.in | 7% |
| First/Middle/Last Initials | JMDoe@galgotiasuniversity.edu.in | 1% |

The authentication workflow must restrict the registration endpoint to accept only HTTP payloads containing the @galgotiasuniversity.edu.in suffix. To prevent the creation of dormant, unauthorized, or fabricated accounts, an asynchronous verification process is an absolute requirement. Upon registration, the system must generate a cryptographically secure, time-limited One-Time Password (OTP) or a verification token transmitted directly to the provided institutional email. The user account remains in a suspended, unverified state within the database until the token is explicitly validated by the client. This challenge-response mechanism guarantees cryptographic proof of access to the institutional inbox.

### **Student Identification Number Integration**

As an alternative or supplementary authentication vector, the system architecture can utilize the university's unique admission and enrollment numbering schema. Institutional records indicate that students are assigned specific alphanumeric identifiers, such as 15SCSE101117, which function as multifaceted login credentials for internal Learning Management Systems (LMS) and library membership portals.

A hybrid architectural approach is recommended for v1: the student ID serves as the primary account username to foster institutional familiarity, but the initial password setup and account activation strictly require a verification link sent to the official university email domain. This dual-layered strategy provides the optimal balance of user convenience, institutional localization, and cryptographic security.

## **Frontend Compiler Interface Architecture**

The explicit requirement to design the compiler on the website constitutes the critical user-facing component of the platform. The frontend application must simulate a comprehensive Integrated Development Environment (IDE) entirely within the browser, capturing user keystrokes, managing syntax highlighting, and formatting payloads for transmission to the execution backend.

### **Code Editor Integration and State Management**

To achieve parity with industry-standard coding platforms, the web frontend should integrate a mature, browser-based text editor, such as the Monaco Editor. The editor component must be wrapped within a reactive state management framework to maintain the current state of the source code, the selected programming language, and the user's custom standard input (stdin).

The frontend architecture must decouple the user interface from the blocking nature of network requests. When a user submits code for evaluation, the interface must immediately transition into a loading state, disabling further submissions to prevent network spam and database race conditions.

### **Payload Serialization and Environmental Discrepancies**

Transmitting raw source code and standard input across HTTP payloads introduces severe parsing vulnerabilities that must be mitigated at the client level before transmission. Special characters, unescaped quotation marks, line breaks, and null bytes within user-generated code frequently break JSON serialization algorithms.

To guarantee transmission fidelity across the network boundary, the frontend application must serialize all source code, standard inputs (stdin), and custom execution flags using Base64 encoding before constructing the JSON payload. Furthermore, the frontend network client must implement a pre-flight sanitization utility that intercepts all outgoing strings and standardizes line endings. Stripping `\r\n` and isolated `\r` characters, converting them uniformly to `\n` prior to Base64 encoding, is a non-negotiable architectural requirement to ensure deterministic execution on the remote Linux servers.

## **Backend API Gateway and Execution Coordination**

The backend application serves as the orchestration layer between the frontend client and the isolated execution engine. It is responsible for authenticating requests, validating payloads against database constraints, and managing the asynchronous lifecycle of code execution.

### **Asynchronous Polling and State Transitions**

The execution of untrusted code is inherently an asynchronous operation. When the frontend transmits a payload, the backend API gateway must not block the HTTP thread waiting for the execution to finish. Instead, the backend submits the payload to the execution engine and immediately receives a unique submission token.

The backend must then enter an asynchronous polling loop, querying the execution engine's `/submissions/{token}` endpoint iteratively to determine the execution state. The state machine for a code submission involves distinct, immutable status identifiers that the backend must map to user-friendly messages:

| Status Code | Execution State | Description |
| :--- | :--- | :--- |
| 1 | In Queue | The payload is waiting in the Redis message broker. |
| 2 | Processing | The worker node is currently compiling or executing the code. |
| 3 | Accepted | Execution completed successfully with a zero exit code. |
| 4 | Wrong Answer | Execution succeeded, but output did not match expected parameters. |
| 5 | Time Limit Exceeded | The process was terminated by the cgroup scheduler for running too long. |
| 6 | Compilation Error | The compiler failed to build the binary (syntax errors). |
| 11 | Runtime Error | The program crashed during execution (e.g., Segmentation fault). |

## **Sandboxed Execution Engine: Architecture and Security**

The core technological challenge of an online coding platform is executing untrusted, potentially malicious code submitted by thousands of students.

### **Integration of the Judge0 Execution Engine**

For an institutional platform's initial deployment, leveraging a mature, pre-built execution engine that abstracts isolation complexities is the most viable strategy. Judge0 is a robust, highly scalable, open-source online code execution system specifically designed to handle the intricacies of sandboxing.

Judge0 operates on a modern, decoupled modular architecture. The actual sandboxing within the Judge0 worker nodes is powered by `isolate`, a specialized utility designed for competitive programming platforms that creates a secure execution environment leveraging native Linux kernel features. `Isolate` constructs a strict chroot jail, applies control groups (cgroups) to enforce rigid memory limits and CPU time quotas, and utilizes kernel namespaces to isolate the process tree and completely disable network interfaces.

### **Defending Against Denial of Service and Resource Exhaustion**

A primary threat vector is the fork bomb—a classic denial-of-service attack wherein a process continuously replicates itself using the `fork()` system call. Without explicit limitations, a fork bomb rapidly depletes the host operating system's Process ID (PID) space.

To prevent a student's erroneous multithreaded script or intentional fork bomb from crashing the execution worker nodes, strict PID limits must be enforced at the container runtime level. When deploying the Judge0 worker nodes, the Docker runtime configuration must explicitly include the `--pids-limit` parameter (e.g., `--pids-limit 100`). Once this hard ceiling is reached, the kernel denies further `fork()` or `clone()` requests, allowing the sandbox manager to safely terminate the container.

## **Relational Database Schema and Data Modeling**

The database architecture is centered around bridging the User entity with the Problem entity to track analytical progress and platform engagement. A robust relational database management system, such as PostgreSQL, is highly recommended to handle structured data, ACID compliance, and integration with the multi-agent AI pipeline.

### **Tracking Progress via Composite Keys**

To track whether a user has successfully solved a problem, a join table named `UserProblem` must be implemented. A critical schema constraint requires a unique composite B-Tree index on the combination of `(userId, problemId)`. This database-level constraint guarantees that a user cannot have duplicate progress records for a single problem and allows the API gateway to execute rapid *upsert* operations.

### **The Dual-Representation Test Case Architecture**

The relational modeling of test cases must satisfy both the execution engine (raw strings) and the human user (formatted variables). The `TestCase` model must implement a dual-representation schema:

| Field Name | Data Type | Purpose | Example Value |
| :--- | :--- | :--- | :--- |
| input | String | Machine-readable raw input piped to stdin. | "4\n2 7 11 15\n9" |
| expectedOutput | String | Machine-readable expected standard output. | "0 1" |
| displayInput | String (Nullable) | Human-readable formatted variable representation. | "nums = [2,7,11,15], target = 9" |
| displayOutput | String (Nullable) | Human-readable formatted return value. | "[0, 1]" |
| visibility | Enum | Access control for the client. | PUBLIC or PRIVATE |

Attempting to dynamically generate human-readable `displayInput` strings from raw input payloads at runtime is computationally expensive. Designing the schema to explicitly store both representations ensures seamless integration with the AI generation agents, which can automatically populate both fields during the problem creation phase.

## **Multi-Agent AI Pipeline: Automated Problem Generation and Validation**

The v1 rollout of the platform requires a vast, dynamically expanding repository of proprietary coding challenges. Relying on manual curation or static database seeding scripts creates a severe content bottleneck and limits the platform's ability to host spontaneous contests. To eliminate this friction, the architecture implements a fully automated, multi-agent Generative AI pipeline engineered with LangChain and orchestrated via LangGraph. 

This state-machine workflow dynamically generates, self-corrects, and validates mathematically sound programming challenges before they ever reach the student-facing database.

### **The Multi-Agent Validation Loop**

Instead of a single AI prompt, which frequently produces broken test cases or hallucinated constraints, the system utilizes a strict quality-control gauntlet comprised of specialized agents:

1. **The Creator Agent:** Generates the foundational problem title, markdown description, strict mathematical constraints (e.g., $1 \le N \le 10^5$), boilerplate starter code, and an initial set of test cases. It is explicitly instructed to format the test cases into the dual-representation schema (raw `input` and `displayInput`) required by the database.
2. **The Validator Agent (Solver):** Operating completely blind to the generated test cases, this secondary agent receives only the problem description and starter code. It is tasked with writing a flawless, optimal solution to the problem.
3. **Sandbox Cross-Validation:** The LangGraph orchestrator intercepts the Validator's solution and automatically routes it to the Judge0 execution engine via the API gateway. The sandbox runs the Validator's code against the Creator's test cases. If the execution fails or times out, the problem is immediately rejected. The error trace is fed back into the LangGraph loop, forcing the Creator Agent to fix the logical discrepancies.
4. **The Edge-Case Hacker:** Once the base problem passes cross-validation, this agent analyzes the defined constraints to generate extreme, boundary-testing inputs (e.g., massive arrays, negative integer limits, or null states) to append to the private test suite.

### **Database Synchronization**

Once a problem successfully navigates the entire LangGraph pipeline without a single compilation or runtime error, the orchestration service utilizes the database's upsert mechanism. It seamlessly writes the verified problem and its multidimensional test cases into the PostgreSQL cluster. This automated pipeline guarantees an infinite, high-quality problem repository that strictly adheres to the established database schema without requiring human review.

## **Code Evaluation Lifecycle and Output Processing**

The backend API architecture requires two distinctly routed endpoints for code evaluation:

1. **The Run Route (`POST /api/execute`)**: This lightweight pathway is utilized when a student wishes to test their code against a single, custom input or the visible public test cases. Crucially, no database comparison is performed, and the user's progress metrics are not updated.
2. **The Submit Route (`POST /api/submit`)**: This heavy-duty pathway initiates a formal, recorded evaluation against all associated test cases (both public and private).

### **Output Evaluation and Early Termination Protocols**

During the Submit sequence, the backend must apply rigorous string-trimming and normalization algorithms to both the actual output and expected output before performing exact-string matching. To optimize execution throughput, if the first or second test case in a sequence results in a Compilation Error, a Time Limit Exceeded status, or a standard Wrong Answer, the backend must immediately break the evaluation loop and halt further asynchronous polling.

## **Infrastructure, Deployment, and Scaling Strategies**

Deploying this architecture requires careful coordination of containerized microservices. The system relies on a multi-container Docker deployment orchestrated via `docker-compose` for the v1 implementation.

### **Operating System Compatibility and Host Selection**

To guarantee deterministic execution and absolute system stability, the underlying cloud infrastructure must be provisioned strictly utilizing Ubuntu 22.04 LTS. This specific distribution provides the precise, stable kernel headers and cgroup v2 compatibility required by the sandbox manager (`isolate`) to efficiently mount and unmount isolated filesystems without race conditions.

### **Container Topology and Network Isolation**

The deployment architecture must cleanly separate the web application, the database layer, the execution engine, and the AI agents. The `docker-compose.yml` configuration will initialize the following distinct services:

1. **Application Backend**: The Node.js, Python, or Go server managing HTTP requests, JWT authentication, and database ORM transactions.
2. **Primary Datastore**: The PostgreSQL instance storing user data, problems, and test cases.
3. **AI Orchestrator**: A specialized Python microservice managing the LangGraph state machine, handling LLM API requests, and coordinating the multi-agent generation loop.
4. **Job Queue**: A Redis container acting as a rapid, in-memory message broker.
5. **Execution API**: The Ruby on Rails REST server (Judge0) receiving code payloads.
6. **Execution Workers**: Background worker nodes (e.g., Sidekiq) that continuously pull from the Redis queue and invoke the sandbox binaries.

To enhance security, the execution workers and the Execution API should operate on an isolated Docker bridge network completely detached from the outbound internet. By adhering to this updated architectural blueprint, the institution can successfully deploy a resilient, highly automated, and highly secure educational platform.