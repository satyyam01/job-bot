# REST API Documentation & Endpoint Reference

The system exposes a lightweight REST API alongside its Telegram bot interface. This document describes the HTTP endpoints, validation schemas, request/response models, and error responses.

---

## 1. Endpoint Reference Table

All REST API endpoints are prefixed with `/api` (excluding `/health`).

| Method | Endpoint | Description | Middleware | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/health` | Server heartbeat and diagnostic status | None | No |
| **POST** | `/api/process-job` | Synchronously scrapes a job URL and tailors the master resume | `apiRateLimiter` | No (API key optional) |
| **POST** | `/api/telegram/webhook` | Handles incoming webhooks from Telegram in production | None | Telegram server validation |

---

## 2. Endpoint Details & Payload Schemas

### A. Server Health Check (`GET /health`)
Verifies that the Express server is online, returning a timestamp:

#### Request:
No request body required.

#### Response (Success - `200 OK`):
```json
{
  "status": "ok",
  "timestamp": "2026-05-26T12:56:56.123Z"
}
```

---

### B. Process Job Posting (`POST /api/process-job`)
Scrapes a job description from a URL, extracts requirements, tailors the resume, and returns the optimized sections with an ATS score.

#### Request Headers:
`Content-Type: application/json`

#### Request Body Schema:
```json
{
  "url": "string (valid URL required)"
}
```

#### Response (Success - `200 OK`):
```json
{
  "success": true,
  "company": "Target Company Name",
  "role": "Target Role Title",
  "atsScore": 92,
  "tailoredResume": "Experience\n\nAccenture...\n\nProjects\n\nFarmTrack...\n\nTechnical Skills\n\nLanguages...",
  "tailoredLatex": "\\documentclass[letterpaper,11pt]{article} ... \\begin{document} ... \\end{document}",
  "pdfPath": "c:\\SatyamsFolder\\projects\\MERN\\job-bot\\logs\\tailored_resume_1716712345678.pdf",
  "structuredJd": {
    "company": "Target Company Name",
    "role_title": "Target Role Title",
    "seniority": "Senior",
    "type": "Full-time",
    "location": "Bangalore, India",
    "work_model": "Hybrid",
    "required_skills": ["Node.js", "LangGraph", "System Architecture"],
    "preferred_skills": ["Redis", "PostgreSQL"],
    "technologies": ["TypeScript", "Groq", "Cohere"],
    "ats_keywords": ["Backend Engineer", "LLM Pipelines"],
    "responsibilities": ["Scale backend AI systems", "Design stateful agents"],
    "qualifications": ["B.Tech CS or equivalent experience"],
    "hidden_expectations": ["High code test coverage"],
    "engineering_culture": "Collaborative, agile, and AI-forward",
    "emphasis": "Backend",
    "hiring_signals": ["Immediate start requested"]
  }
}
```

#### Response (Scraper / Tailoring Failure - `200 OK` with `success: false`):
If an error occurs during scraping or processing, the API handles the exception gracefully, returning a `success: false` status with the error message:
```json
{
  "success": false,
  "error": "Firecrawl Error: Scrape attempt failed - Target resource block: Cloudflare challenge"
}
```

---

### C. Telegram Webhook Endpoint (`POST /api/telegram/webhook`)
Receives incoming messages from Telegram's servers when the bot is running in production webhook mode.

#### Request Headers:
`Content-Type: application/json`

#### Request Body Schema:
Passes the standard Telegram Update payload received from the Telegram API.

#### Response (Success - `200 OK`):
Returns an empty `200 OK` status back to Telegram to acknowledge receipt of the message:
`OK`

---

## 3. Global Error Format

If the API encounters an unhandled exception or validation failure, the global error middleware formats the response:

### A. Missing or Malformed URL Input (`400 Bad Request`)
Returned if a request to `/api/process-job` is missing the `url` parameter:
```json
{
  "success": false,
  "error": "URL is required"
}
```

### B. Rate Limit Exceeded (`429 Too Many Requests`)
Returned if a client exceeds the limit of 100 requests within a 15-minute window:
```json
{
  "success": false,
  "error": "Too many requests, please try again later."
}
```

### C. Internal Server Error (`500 Internal Server Error`)
Returned for unhandled database, network, or server exceptions:
```json
{
  "success": false,
  "error": "Internal Server Error"
}
```
