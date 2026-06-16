# **Architectural Blueprint and Technical Specifications for an Institutional Code Execution Platform**

## **Introduction and System Vision**

The pedagogical landscape of computer science education has increasingly pivoted toward interactive, browser-based environments that empower students to write, compile, and execute code without the friction of configuring localized development environments. The deployment of a specialized, closed-ecosystem coding platform specifically tailored for a single institution presents unique architectural challenges, security paradigms, and operational opportunities. By restricting access to a predefined institutional cohort, the system can leverage existing identity management infrastructure, optimize computational resource allocation, and foster a localized, highly engaged competitive programming ecosystem.  
Developing the inaugural iteration (v1) of such a platform necessitates a robust foundational architecture capable of supporting complex asynchronous operations. This foundational layer must gracefully handle source code ingestion through a web-based interface, secure compilation, strictly isolated execution, and deterministic output evaluation against multidimensional test cases. Furthermore, it requires a rigorously normalized database schema to track student progress, manage a curated repository of algorithmic problems, and securely store evaluation test cases without exposing private evaluation criteria to the client. This report delineates an exhaustive architectural blueprint for constructing an institutional online judge, focusing extensively on identity verification tailored to Galgotias University, the integration of a web-based compiler, sandboxed code execution, defense mechanisms against malicious payloads, and relational data modeling designed to initialize an ecosystem of proprietary coding challenges.

## **Institutional Identity Management and Access Control**

A paramount requirement for an institutional platform is ensuring that the ecosystem remains hermetically sealed, permitting access strictly to currently enrolled students. This mandates a stringent authentication gateway that maps digital identities to verifiable institutional records, preventing external actors from consuming computational resources or accessing proprietary problem sets.

### **Institutional Email Verification and Domain Constraints**

The primary mechanism for establishing student identity securely relies on the institution's official email domain infrastructure. An analysis of the digital identity patterns at Galgotias University reveals specific formatting conventions utilized for student email provisioning.1 The domain galgotiasuniversity.edu.in serves as the primary identifier, with the institutional infrastructure predominantly operating on a Gmail-based ecosystem.2  
The distribution of email address formats follows established nomenclatures, which must be systematically accounted for when designing regular expressions for the registration validation pipeline.

| Format Structure | Pattern Example | Prevalence |
| :---- | :---- | :---- |
| First.Last | John.Doe@galgotiasuniversity.edu.in | 92% |
| First Only | John@galgotiasuniversity.edu.in | 7% |
| First/Middle/Last Initials | JMDoe@galgotiasuniversity.edu.in | 1% |

The authentication workflow must restrict the registration endpoint to accept only HTTP payloads containing the @galgotiasuniversity.edu.in suffix.3 To prevent the creation of dormant, unauthorized, or fabricated accounts, an asynchronous verification process is an absolute requirement. Upon registration, the system must generate a cryptographically secure, time-limited One-Time Password (OTP) or a verification token transmitted directly to the provided institutional email.3 The user account remains in a suspended, unverified state within the database until the token is explicitly validated by the client. This challenge-response mechanism guarantees cryptographic proof of access to the institutional inbox, neutralizing the threat of unauthorized registrations.

### **Student Identification Number Integration**

As an alternative or supplementary authentication vector, the system architecture can utilize the university's unique admission and enrollment numbering schema.4 Institutional records indicate that students are assigned specific alphanumeric identifiers, such as 15SCSE101117, which function as multifaceted login credentials for internal Learning Management Systems (LMS) and library membership portals.5  
If the platform utilizes student ID-based login mechanics, the authentication service must cross-reference these identifiers against an institutional database. In the absence of a direct API integration with the university's central Active Directory or Enterprise Resource Planning (ERP) system for the v1 deployment, the initial version of the platform could theoretically rely on a pre-seeded, encrypted database of valid student enrollment numbers.7  
However, relying solely on student IDs without a secondary verification channel introduces severe security vulnerabilities. Student identification numbers are frequently printed on physical campus cards and are inherently public within the university environment.9 Therefore, a hybrid architectural approach is recommended for v1: the student ID (e.g., 15SCSE101117) serves as the primary account username to foster institutional familiarity, but the initial password setup and account activation strictly require a verification link sent to the official university email domain. This dual-layered strategy provides the optimal balance of user convenience, institutional localization, and cryptographic security.

## **Frontend Compiler Interface Architecture**

The explicit requirement to design the compiler on the website constitutes the critical user-facing component of the platform. The frontend application must simulate a comprehensive Integrated Development Environment (IDE) entirely within the browser, capturing user keystrokes, managing syntax highlighting, and formatting payloads for transmission to the execution backend.

### **Code Editor Integration and State Management**

To achieve parity with industry-standard coding platforms, the web frontend should integrate a mature, browser-based text editor, such as the Monaco Editor (the technology underlying Visual Studio Code). The editor component must be wrapped within a reactive state management framework (e.g., React with Redux or Zustand) to maintain the current state of the source code, the selected programming language, and the user's custom standard input (stdin).  
The frontend architecture must decouple the user interface from the blocking nature of network requests. When a user submits code for evaluation, the interface must immediately transition into a loading state, disabling further submissions to prevent network spam and database race conditions. The state manager must listen for asynchronous updates from the API gateway, dynamically rendering standard output (stdout), standard error (stderr), and compilation metrics without requiring a full page reload.

### **Payload Serialization and Environmental Discrepancies**

Transmitting raw source code and standard input across HTTP payloads introduces severe parsing vulnerabilities that must be mitigated at the client level before transmission. Special characters, unescaped quotation marks, line breaks, and null bytes within user-generated code frequently break JSON serialization algorithms, resulting in generic 500 Internal Server Error responses from the backend.10  
To guarantee transmission fidelity across the network boundary, the frontend application must serialize all source code, standard inputs (stdin), and custom execution flags using Base64 encoding before constructing the JSON payload.11  
A secondary, highly prevalent failure vector involves operating system line-ending discrepancies. Code written, copied, or submitted from Windows operating systems utilizes Carriage Return Line Feed (\\r\\n) characters, whereas the Linux-based execution sandboxes operating on the server expect strict Line Feed (\\n) terminators.11 When standard library functions in compiled languages like C++ (std::cin) or interpreted languages like Python (input()) process standard input containing carriage returns, the trailing \\r is often incorrectly ingested as part of the string or integer. This causes subsequent algorithmic parsing logic to fail silently, resulting in incorrect outputs despite the user's logic being theoretically sound.11  
The frontend network client must implement a pre-flight sanitization utility that intercepts all outgoing strings and standardizes line endings. Stripping \\r\\n and isolated \\r characters, converting them uniformly to \\n prior to Base64 encoding, is a non-negotiable architectural requirement to ensure deterministic execution on the remote Linux servers.11

## **Backend API Gateway and Execution Coordination**

The backend application serves as the orchestration layer between the frontend client and the isolated execution engine. It is responsible for authenticating requests, validating payloads against database constraints, and managing the asynchronous lifecycle of code execution.

### **Asynchronous Polling and State Transitions**

The execution of untrusted code is inherently an asynchronous operation; it requires sandbox provisioning, compilation, execution, and output extraction. When the frontend transmits a payload, the backend API gateway must not block the HTTP thread waiting for the execution to finish. Instead, the backend submits the payload to the execution engine and immediately receives a unique submission token.11  
The backend must then enter an asynchronous polling loop, querying the execution engine's /submissions/{token} endpoint iteratively to determine the execution state.11 To optimize server resources and reduce perceived latency for the student, the polling interval should be aggressively tuned. While a 1000-millisecond delay is a standard baseline, reducing the polling interval to 300-500 milliseconds provides a significantly snappier user experience during single test case evaluations, mimicking real-time execution.11  
The state machine for a code submission involves distinct, immutable status identifiers that the backend must map to user-friendly messages:

| Status Code | Execution State | Description |
| :---- | :---- | :---- |
| 1 | In Queue | The payload is waiting in the Redis message broker. |
| 2 | Processing | The worker node is currently compiling or executing the code. |
| 3 | Accepted | Execution completed successfully with a zero exit code. |
| 4 | Wrong Answer | Execution succeeded, but output did not match expected parameters. |
| 5 | Time Limit Exceeded | The process was terminated by the cgroup scheduler for running too long. |
| 6 | Compilation Error | The compiler failed to build the binary (syntax errors). |
| 11 | Runtime Error | The program crashed during execution (e.g., Segmentation fault). |

The polling loop continues until the submission status transcends the queued (1) and processing (2) states. Once a terminal state is reached, the API gateway formats the response, decodes the Base64 output streams, and resolves the HTTP request back to the frontend client.

## **Sandboxed Execution Engine: Architecture and Security**

The core technological challenge of an online coding platform is executing untrusted, potentially malicious code submitted by thousands of students. If a user submits a script designed to format the host server's hard drive, access local network resources, or consume infinite memory, the system must neutralize the threat seamlessly while returning an appropriate error code.

### **Evaluation of Sandboxing Technologies**

The spectrum of process isolation ranges from rudimentary process control to hardware-level virtualization. Selecting the correct layer of isolation dictates the platform's security posture, infrastructure cost, and execution latency.

| Isolation Approach | Filesystem Access | Network Access | Kernel Resource | Startup Latency | Compatibility |
| :---- | :---- | :---- | :---- | :---- | :---- |
| ProcessBuilder | Full Access | Full Access | Shared Kernel | 0 ms | 100% |
| Docker \+ Seccomp | Isolated | Disabled | Shared (Filtered) | \~300 ms | 100% |
| gVisor (runsc) | Isolated | Disabled | User-space Kernel | \~400 ms | 95% |
| Firecracker microVM | Isolated | Disabled | Separate Guest Kernel | \~125 ms | 100% |

Executing user code directly via operating system sub-processes (like Java's ProcessBuilder or Python's subprocess) is catastrophic, as a single malicious script can compromise the host machine.12 Containerization via standard Docker limits filesystem visibility but still shares the host Linux kernel.13 A sophisticated attacker can exploit a kernel vulnerability from within a standard Docker container to achieve a sandbox escape.  
To mitigate this, enterprise-grade online judges utilize user-space kernels like gVisor or hardware-level microVMs like Firecracker.12 Firecracker, utilized heavily in serverless cloud architectures, provisions a separate, minimal Linux kernel for every single execution. This ensures that even a successful kernel exploit remains trapped inside a 256MB virtual machine with disabled network interfaces.12 However, managing a warm pool of Firecracker microVMs to eliminate boot latency requires substantial, complex infrastructure engineering that falls outside the scope of a v1 institutional deployment.12

### **Integration of the Judge0 Execution Engine**

For an institutional platform's initial deployment, leveraging a mature, pre-built execution engine that abstracts these isolation complexities is the most viable and secure strategy. Judge0 is a robust, highly scalable, open-source online code execution system specifically designed to handle the intricacies of sandboxing.16 Instead of engineering a custom sandbox from scratch, deploying Judge0 provides immediate, out-of-the-box support for over 60 programming languages and handles the complex orchestration of compilation commands and execution limits.16  
Judge0 operates on a modern, decoupled modular architecture.16 The ecosystem comprises a REST API server built in Ruby on Rails, a PostgreSQL database for storing submission metadata, a Redis instance for message queueing, and background worker nodes processing jobs asynchronously via Sidekiq.10 When the backend API gateway transmits user code, it hits the Judge0 API, which records the request and pushes a job to Redis.  
The actual sandboxing within the Judge0 worker nodes is powered by isolate, a specialized utility designed for competitive programming platforms that creates a secure execution environment leveraging native Linux kernel features.18 Isolate constructs a strict chroot jail, applies control groups (cgroups) to enforce rigid memory limits and CPU time quotas, and utilizes kernel namespaces to isolate the process tree and completely disable network interfaces.  
By self-hosting Judge0 on university-provisioned infrastructure, the platform avoids the severe rate limits and recurring costs associated with commercial compiler APIs. For instance, commercial alternatives like JDoodle restrict free-tier usage to a mere 100 code executions per day and strictly cap CPU resources, which is woefully insufficient for an active student user base participating in assignments and competitions.19 An open-source, self-hosted Judge0 instance allows unlimited, highly concurrent executions bound only by the underlying server hardware.17

### **Defending Against Denial of Service and Resource Exhaustion**

Providing a compiler to university students guarantees that, either maliciously or accidentally, the system will process infinite loops, memory leaks, and process-spawning scripts. The infrastructure must be aggressively hardened against Resource Exhaustion attacks.  
A primary threat vector is the fork bomb—a classic denial-of-service attack wherein a process continuously replicates itself using the fork() system call. Without explicit limitations, a fork bomb rapidly depletes the host operating system's Process ID (PID) space.22 The Linux kernel has a finite number of PIDs available globally (often around 32,768). If a single containerized process exhausts this pool, the entire host system loses the ability to spawn new processes, leading to total systemic failure, service degradation, and a requirement for a hard reboot.22  
To prevent a student's erroneous multithreaded script or intentional fork bomb from crashing the execution worker nodes, strict PID limits must be enforced at the container runtime level.24 When deploying the Judge0 worker nodes, the Docker runtime configuration must explicitly include the \--pids-limit parameter.24  
By setting a parameter such as \--pids-limit 100, the execution environment restricts the container to a maximum of 100 concurrent processes.24 Once this hard ceiling is reached, the kernel denies further fork() or clone() requests from that specific cgroup.22 The process attempting the fork receives an EAGAIN error, allowing the sandbox manager to safely terminate the container, report a Status 11 (Runtime Error) to the user, and maintain the integrity of the host system.22 Because the default value for \--pids-limit in Docker is 0 (unlimited), manual and explicit configuration of this parameter in the deployment manifests is a critical security mandate.24

## **Relational Database Schema and Data Modeling**

The structural integrity and analytical capabilities of a coding platform rely heavily on its database schema. The platform must manage authenticated users, a repository of programming problems, hidden and public test cases, and the relational tracking of user progress. A robust relational database management system, such as PostgreSQL, is highly recommended due to its stringent adherence to ACID properties, support for complex indexing, and seamless integration with modern Object-Relational Mappers (ORMs).11

### **Core Entity Relationships and Upsert Mechanisms**

The database architecture is centered around bridging the User entity with the Problem entity to track analytical progress and platform engagement.

1. **Users and Problems**: The User table stores identity metrics (institutional email, student ID, encrypted passwords, authentication state), while the Problem table stores the static attributes of the coding challenges (Title, Description, Difficulty, Constraints, CPU Time Limits).  
2. **Tracking Progress via Composite Keys**: To track whether a user has successfully solved a problem, a join table named UserProblem must be implemented.11 This table tracks metrics such as confidence level, total submission counts, time spent, and binary completion status. A critical schema constraint requires a unique composite B-Tree index on the combination of (userId, problemId).11 This database-level constraint guarantees that a user cannot have duplicate progress records for a single problem, preventing race conditions if a user rapidly double-clicks a submission button. Furthermore, this unique index allows the API gateway to execute *upsert* operations—updating the progress record if it already exists, or creating it natively if it does not, entirely eliminating the need for expensive, latency-inducing read-before-write transactions.11

### **The Dual-Representation Test Case Architecture**

The relational modeling of test cases is arguably the most complex schema decision in an online judge. Test cases serve two fundamentally conflicting masters: the execution engine, which requires raw, unformatted string data to pipe into stdin, and the human user, who requires readable context and formatted variables.11  
To satisfy both requirements without introducing severe backend parsing latency, the TestCase model must implement a dual-representation schema from day one:

| Field Name | Data Type | Purpose | Example Value |
| :---- | :---- | :---- | :---- |
| input | String | Machine-readable raw input piped to stdin. | "4\\n2 7 11 15\\n9" |
| expectedOutput | String | Machine-readable expected standard output. | "0 1" |
| displayInput | String (Nullable) | Human-readable formatted variable representation. | "nums \= , target \= 9" |
| displayOutput | String (Nullable) | Human-readable formatted return value. | "" |
| visibility | Enum | Access control for the client. | PUBLIC or PRIVATE |

Attempting to dynamically generate human-readable displayInput strings from raw input payloads at runtime is computationally expensive and highly prone to parsing errors, especially for complex data structures like linked lists, matrices, or binary trees.11 Designing the schema to explicitly store both representations prevents substantial architectural refactoring and data migration pain when the problem repository inevitably expands.11  
Furthermore, a cascading delete constraint must be configured between the Problem table and the TestCase table. If a problem is removed from the platform by an administrator, the database engine must automatically purge all associated test cases to maintain strict referential integrity and prevent the accumulation of orphaned records.11

### **Access Control and Visibility Flagging**

Test cases must be logically partitioned into public and private tiers using a visibility enum.11 Public test cases are transmitted to the frontend and rendered in the platform's user interface, allowing students to test their logic against known variables and debug syntax. Private test cases are strictly retained on the server and utilized solely during formal evaluation.  
If the application backend inadvertently transmits private test case data to the frontend client within a generic JSON response, tech-savvy students can simply inspect the browser's network payload, discover the hidden inputs, and write static conditional statements (e.g., if input \== "hidden\_value" return "correct\_answer") to bypass the algorithmic requirements of the problem entirely.  
The backend application must rigorously sanitize the database query results, stripping the input and expectedOutput fields from any test case marked with a PRIVATE visibility enum before serializing the JSON response back to the client.11

## **Content Seeding Pipeline: Provisioning the Problem Repository**

The v1 rollout of the platform explicitly requires an initial repository of approximately 100 curated coding questions, with 50 designed specifically as proprietary, platform-exclusive challenges. Manually entering 100 questions, along with their associated multidimensional test cases, via a graphical user interface or direct SQL insertions is highly susceptible to human error, incredibly tedious, and complicates deployment synchronization across local, staging, and production environments.  
The architecture mandates the implementation of an automated, idempotent database seeding script.11 Idempotency ensures that the seeding script can be executed infinitely without creating duplicate records or crashing the deployment pipeline due to existing primary key violations.  
The problem repository, including problem descriptions, constraints, and test case specifications, should be maintained in a structured data format (such as JSON or YAML) directly within the source code's version control repository.  
During the Continuous Integration/Continuous Deployment (CI/CD) pipeline, the deployment process triggers the backend seeding script. The script iterates through the JSON files and utilizes the upsert database mechanism to seamlessly synchronize the database state—adding new questions, updating altered test cases, and gracefully ignoring unmodified records.11 This infrastructure-as-code approach entirely eliminates manual database cleanup operations, ensures the proprietary problem set is perfectly replicated across any deployed instance of the platform, and allows curriculum designers to version-control the coding challenges just like source code.11

## **Code Evaluation Lifecycle and Output Processing**

The platform must expose distinct execution pathways depending on the user's intent. Differentiating between casual debugging and formal evaluation preserves computational resources and prevents the worker queues from becoming unnecessarily congested.

### **The Run versus Submit Execution Paradigms**

The backend API architecture requires two distinctly routed endpoints for code evaluation:

1. **The Run Route (POST /api/execute)**: This lightweight pathway is utilized when a student wishes to test their code against a single, custom input or the visible public test cases. The backend transmits the code and the explicit inputs to the execution engine, retrieves the stdout and stderr streams, and returns them directly to the client. Crucially, no database comparison is performed, and the user's progress metrics are not updated.11 This route prioritizes speed and debugging utility.  
2. **The Submit Route (POST /api/submit)**: This heavy-duty pathway initiates a formal, recorded evaluation. The backend fetches all associated test cases (both public and private) from the database. The user's code is executed against these test cases sequentially.

### **Output Evaluation and Early Termination Protocols**

During the Submit sequence, output comparison must be handled meticulously by the backend API. The raw stdout retrieved from the execution engine often contains trailing spaces, invisible carriage returns, or newline characters that differ imperceptibly from the strict expectedOutput stored in the database. The backend must apply rigorous string-trimming and normalization algorithms to both the actual output and expected output before performing exact-string matching to determine if the student's logic is correct.  
To optimize execution throughput and protect server resources, the evaluation loop must implement an early exit protocol.11 If the first or second test case in a sequence results in a Compilation Error, a Time Limit Exceeded status, or a standard Wrong Answer, there is no mathematical utility in executing the subsequent test cases. The code is already deemed a failure. The backend must immediately break the evaluation loop, halt further asynchronous polling for that specific submission, and return the failure status to the user.11 This early termination strategy drastically reduces the load on the Redis queue and frees up the worker node to process other students' submissions, which is critical during high-traffic periods like examinations or competitive programming events.11

## **Infrastructure, Deployment, and Scaling Strategies**

Deploying this architecture requires careful coordination of containerized services. The system relies on a multi-container Docker deployment orchestrated via docker-compose for the v1 implementation, providing a balance of isolation and operational simplicity.

### **Operating System Compatibility and Host Selection**

The choice of the underlying host Operating System is a critical factor in the stability of the sandboxing environment. The isolate utility, which manages the intricate Linux namespaces and cgroup allocations for the Judge0 execution engine, is deeply coupled with kernel versions. Empirical architectural evidence demonstrates that deploying these specific sandboxing tools on newer, heavily modified kernel distributions (such as Ubuntu 24.04) introduces severe compatibility regressions. These regressions often manifest as deadlocks, causing asynchronous submissions to hang indefinitely without ever returning a status code to the polling backend.11  
To guarantee deterministic execution and absolute system stability, the underlying cloud infrastructure—whether a Virtual Private Server (VPS) instance from a cloud provider or a locally hosted blade server within the university's data center—must be provisioned strictly utilizing Ubuntu 22.04 LTS.11 This specific distribution provides the precise, stable kernel headers and cgroup v2 compatibility required by the sandbox manager to efficiently mount and unmount isolated filesystems without race conditions.11

### **Container Topology and Network Isolation**

The deployment architecture must cleanly separate the web application, the database layer, and the execution engine into microservices. The docker-compose.yml configuration will initialize the following distinct services:

1. **Application Backend**: The Node.js, Python, or Go server managing HTTP requests, JWT authentication, and database ORM transactions.  
2. **Primary Datastore**: The PostgreSQL instance storing user data, problems, and test cases.11  
3. **Job Queue**: A Redis container acting as a rapid, in-memory message broker.  
4. **Execution API**: The Ruby on Rails REST server receiving code payloads.10  
5. **Execution Workers**: Background worker nodes (e.g., Sidekiq) that continuously pull from the Redis queue and invoke the sandbox binaries.10

To enhance security, the execution workers and the Execution API should operate on an isolated Docker bridge network. They should absolutely not have outbound internet access, preventing malicious code from executing Server-Side Request Forgery (SSRF) attacks or downloading external payloads. The Application Backend acts as the sole API gateway bridging the public-facing internet and the internal execution network, validating authentication tokens and sanitizing payloads before forwarding them to the execution engine. As the platform scales beyond v1, handling increased concurrent load from the student body can be seamlessly managed by scaling up the number of replica worker nodes attached to the Redis queue, ensuring that execution times remain consistently low regardless of user volume.  
By adhering to this comprehensive architectural blueprint, the institution can successfully deploy a resilient, scalable, and highly secure educational platform that fulfills all bespoke requirements while maintaining parity with industry-standard code execution environments.

#### **Works cited**

1. Galgotias University Company Overview, Contact Details & Competitors \- LeadIQ, accessed on May 20, 2026, [https://leadiq.com/c/galgotias-university/5dcc1a781b6efee692e90c93](https://leadiq.com/c/galgotias-university/5dcc1a781b6efee692e90c93)  
2. Galgotias University, accessed on May 20, 2026, [https://galgotiasonline.edu.in/images/galgotia/pdf/galgotias-university-document4.pdf](https://galgotiasonline.edu.in/images/galgotia/pdf/galgotias-university-document4.pdf)  
3. With official email ID (@galgotiasuniversity.edu.in) one can register ..., accessed on May 20, 2026, [https://www.galgotiasuniversity.edu.in/public/uploads/media/2eqOSFL0ari4Y7wtEb49FU8BsUMsMji3u3OWx4z5.pdf](https://www.galgotiasuniversity.edu.in/public/uploads/media/2eqOSFL0ari4Y7wtEb49FU8BsUMsMji3u3OWx4z5.pdf)  
4. Galgotias University 2025 Student List | PDF \- Scribd, accessed on May 20, 2026, [https://www.scribd.com/document/832030571/Galgotias-Selected-List](https://www.scribd.com/document/832030571/Galgotias-Selected-List)  
5. Student's first time Login \- LMS, accessed on May 20, 2026, [https://lms.galgotiasuniversity.org/pluginfile.php/66115/mod\_forum/attachment/6591/Help%20Document%20-%20GU%20Students%20first%20time%20Login.pdf?forcedownload=1](https://lms.galgotiasuniversity.org/pluginfile.php/66115/mod_forum/attachment/6591/Help%20Document%20-%20GU%20Students%20first%20time%20Login.pdf?forcedownload=1)  
6. Students Services Module within iCloud \- LMS, accessed on May 20, 2026, [https://lms.galgotiasuniversity.org/pluginfile.php/66115/mod\_forum/attachment/12950/Students%20Services%20Module%20within%20iCloud.pdf?forcedownload=1](https://lms.galgotiasuniversity.org/pluginfile.php/66115/mod_forum/attachment/12950/Students%20Services%20Module%20within%20iCloud.pdf?forcedownload=1)  
7. Student Login Credentials List | PDF \- Scribd, accessed on May 20, 2026, [https://www.scribd.com/document/915909372/Login-Credential-1](https://www.scribd.com/document/915909372/Login-Credential-1)  
8. Galgotias University Student List | PDF \- Scribd, accessed on May 20, 2026, [https://www.scribd.com/document/985646353/College-Dunia](https://www.scribd.com/document/985646353/College-Dunia)  
9. Student ID Card Form 2023-24 | PDF \- Scribd, accessed on May 20, 2026, [https://www.scribd.com/document/642969134/STUDENT-INFORMATION-FORM-FOR-ID-CARD-pdf](https://www.scribd.com/document/642969134/STUDENT-INFORMATION-FORM-FOR-ID-CARD-pdf)  
10. Migrating DB and Redis to local instances breaks the code · Issue \#68 \- GitHub, accessed on May 20, 2026, [https://github.com/judge0/api/issues/68](https://github.com/judge0/api/issues/68)  
11. How to Build a LeetCode-Style Platform \- The Real System Design ..., accessed on May 20, 2026, [https://akashdwivedi.me/blog/system-design-leetcode](https://akashdwivedi.me/blog/system-design-leetcode)  
12. How would you design code execution isolation for 50M submissions/day? Firecracker vs gVisor vs Docker : r/softwarearchitecture \- Reddit, accessed on May 20, 2026, [https://www.reddit.com/r/softwarearchitecture/comments/1sjkylo/how\_would\_you\_design\_code\_execution\_isolation\_for/](https://www.reddit.com/r/softwarearchitecture/comments/1sjkylo/how_would_you_design_code_execution_isolation_for/)  
13. System Design: LeetCode (Code Sandbox, Container Isolation, Real-Time Contests), accessed on May 20, 2026, [https://crackingwalnuts.com/post/leetcode-system-design](https://crackingwalnuts.com/post/leetcode-system-design)  
14. Scaling Agentic-RL Sandboxes to the Millions with gVisor at Tencent, accessed on May 20, 2026, [https://gvisor.dev/blog/2026/04/23/scaling-agentic-rl-sandboxes-to-the-millions-with-gvisor-at-tencent/](https://gvisor.dev/blog/2026/04/23/scaling-agentic-rl-sandboxes-to-the-millions-with-gvisor-at-tencent/)  
15. Design a Global-Scale Online Judge System | by Dilip Kumar | Medium, accessed on May 20, 2026, [https://dilipkumar.medium.com/design-an-online-judge-like-leetcode-30ff9e73b248](https://dilipkumar.medium.com/design-an-online-judge-like-leetcode-30ff9e73b248)  
16. Judge0 CE \- API Docs, accessed on May 20, 2026, [https://ce.judge0.com/](https://ce.judge0.com/)  
17. Judge0 \- Code Execution Made Simple for Every Business, accessed on May 20, 2026, [https://judge0.com/](https://judge0.com/)  
18. Judge0 Sandbox Escape \- Tanto Security, accessed on May 20, 2026, [https://tantosec.com/blog/judge0/](https://tantosec.com/blog/judge0/)  
19. JDoodle Pricing, accessed on May 20, 2026, [https://www.jdoodle.com/pricing](https://www.jdoodle.com/pricing)  
20. JDoodle \- Free AI powered Online Coding Platform, accessed on May 20, 2026, [https://www.jdoodle.com/](https://www.jdoodle.com/)  
21. Free for Developers, accessed on May 20, 2026, [https://free-for.dev/](https://free-for.dev/)  
22. How to Run a Container with PID Limits in Podman \- OneUptime, accessed on May 20, 2026, [https://oneuptime.com/blog/post/2026-03-16-run-container-pid-limits-podman/view](https://oneuptime.com/blog/post/2026-03-16-run-container-pid-limits-podman/view)  
23. Process ID Limiting for Stability Improvements in Kubernetes 1.14, accessed on May 20, 2026, [https://kubernetes.io/blog/2019/04/15/process-id-limiting-for-stability-improvements-in-kubernetes-1.14/](https://kubernetes.io/blog/2019/04/15/process-id-limiting-for-stability-improvements-in-kubernetes-1.14/)  
24. 5.28 Ensure that the PIDs cgroup limit is used | Tenable®, accessed on May 20, 2026, [https://www.tenable.com/audits/items/CIS\_Docker\_v1.5.0\_L1\_Docker\_Linux.audit:330d886c8cb641b2ec492c0eedd38390](https://www.tenable.com/audits/items/CIS_Docker_v1.5.0_L1_Docker_Linux.audit:330d886c8cb641b2ec492c0eedd38390)  
25. Limit number of processes started inside docker container \- Stack Overflow, accessed on May 20, 2026, [https://stackoverflow.com/questions/28237906/limit-number-of-processes-started-inside-docker-container](https://stackoverflow.com/questions/28237906/limit-number-of-processes-started-inside-docker-container)  
26. Container runtime should include the \--pids-limit flag for cgroup limit parameter, accessed on May 20, 2026, [https://docs.datadoghq.com/security/default\_rules/3sx-8aj-uca/](https://docs.datadoghq.com/security/default_rules/3sx-8aj-uca/)  
27. The Postgres development platform. Supabase gives you a dedicated Postgres database to build your web, mobile, and AI applications. \- GitHub, accessed on May 20, 2026, [https://github.com/supabase/supabase](https://github.com/supabase/supabase)