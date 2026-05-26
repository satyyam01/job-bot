# Documentation Index - AI Resume Tailor Bot

Welcome to the internal engineering documentation catalog for the **AI Resume Tailor Bot** (job-bot). This directory contains detailed system design specs, sequence diagrams, API references, AI pipelines, and onboarding guides.

---

## 🗺️ Documentation Roadmap

Below is a categorized index of all generated documentation files. Use the links to navigate the resources:

### 🚀 Getting Started & System Overview
- **[System Overview](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/SYSTEM_OVERVIEW.md)**: A high-level technical overview of the product, tech stack matrix, operational boundaries, and block diagrams.
- **[Guides & Onboarding](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/guides.md)**: Local installation instructions, development workflows, testing scripts, and debugging procedures.

### 📐 Architecture & Module Blueprint
- **[Architecture Map](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/ARCHITECTURE_MAP.md)**: Project folder layouts, import diagrams, dependency maps, and interface definitions.
- **[In-Depth Architecture](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/architecture.md)**: Deep dive into sequential vs stateful orchestration patterns, request lifecycles, and scaling trade-offs.
- **[Backend Design](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/backend.md)**: Express runtime configurations, ApiController architecture, global error interception, and Winston logging setups.
- **[Frontend & API Integration](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/frontend.md)**: Client interfaces (Telegram Chatbot) and REST API hooks for external frontend integration.
- **[Database Statelessness](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/database.md)**: Analysis of the completely stateless, in-memory state engine, filesystem parsing, and conceptual Redis caches.

### 🧠 Core Operations, Flows, & AI Pipelines
- **[Operational Flows](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/flows.md)**: Step-by-step processing paths for web crawling (Firecrawl), structured extraction, and paged Telegram delivery.
- **[AI Pipeline & Models](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/ai.md)**: In-depth analysis of the LangGraph state machine, Cohere embedding calculations, optimization scoring weights, and self-healing LLM retry logic.

### 🔒 Security, API Reference, & Production
- **[Security Architecture](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/security.md)**: Security implementations including Helmet headers, CORS parameters, Zod validations, rate limiting, and webhook validation.
- **[REST API Reference](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/api.md)**: Full REST API endpoint reference, request schemas, success models, and error responses.
- **[Deployment & Infrastructure](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/deployment.md)**: Checklist of environment variables, server requirements, PM2 process management, and API rate-limiting strategies.
- **[Architectural Decisions (ADRs)](file:///c:/SatyamsFolder/projects/MERN/job-bot/docs/decisions.md)**: Architectural Decision Records documenting the core design decisions, trade-offs, and technologies selected (LangGraph loops, statelessness, Telegram UI).
