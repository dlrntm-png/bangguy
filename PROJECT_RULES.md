# 📋 Project Rules & Guidelines

This document outlines the architecture, styling, and coding conventions for the **Attendance IP Check** project.

---

## 🏗️ Architecture Rules

### 1.1 Project Structure
- ✅ **Monolithic Server**: Keep all server logic in `server/index.js` for simplicity
- ✅ **Static Files**: Place all frontend assets in `public/` directory
- ✅ **Auto-generated Directories**: `server/logs/` and `server/uploads/` are created automatically
- ❌ **Do NOT** create nested route handlers or separate controller files (unless project scales significantly)

### 1.2 Module System
- ✅ **ESM Only**: Always use ES Modules (`import`/`export`)
- ✅ **File Extension**: Use `.js` for all JavaScript files
- ✅ **Type Field**: Ensure `"type": "module"` in `package.json`
- ❌ **Do NOT** use CommonJS (`require`/`module.exports`)

### 1.3 Server Architecture
- ✅ **Express Framework**: Use Express.js for HTTP server
- ✅ **Middleware Order**: Apply middleware in this order:
  1. CORS
  2. JSON parser
  3. Static file serving
  4. Route handlers
- ✅ **Trust Proxy**: Always configure `trust proxy` for production environments
- ✅ **Error Handling**: Use try-catch blocks, but avoid empty catch blocks in critical paths

### 1.4 Data Storage
- ✅ **File-based Logging**: Use CSV files for attendance logs (`server/logs/attendance.csv`)
- ✅ **Local File Storage**: Store uploaded photos in `server/uploads/`
- ⚠️ **Future Migration**: Plan for database migration (PostgreSQL/SQLite) when scaling
- ✅ **CSV Format**: Include header row on first write, append data rows

### 1.5 API Design
- ✅ **RESTful Endpoints**: Use standard HTTP methods (GET, POST)
- ✅ **JSON Responses**: Always return JSON for API endpoints
- ✅ **Status Codes**: Use appropriate HTTP status codes:
  - `200`: Success (even for validation failures with messages)
  - `400`: Bad Request (missing required fields)
  - `403`: Forbidden (IP validation failure - if blocking)
  - `500`: Internal Server Error
- ✅ **Response Structure**: Include `{ ok: boolean, ...data }` pattern for consistency

---

## 🎨 Styling Rules

### 2.1 Code Formatting
- ✅ **Indentation**: Use 2 spaces (no tabs)
- ✅ **Line Length**: Keep lines under 100 characters when possible
- ✅ **Semicolons**: Optional (project uses no semicolons)
- ✅ **Quotes**: Use single quotes for strings (or double quotes, but be consistent)
- ✅ **Trailing Commas**: Use in multi-line objects/arrays

### 2.2 Naming Conventions

#### Variables & Functions
- ✅ **camelCase**: `getClientIp`, `isOfficeIp`, `employeeId`
- ✅ **Descriptive Names**: Use clear, self-documenting names
- ❌ **Avoid Abbreviations**: Prefer `employeeId` over `empId` in code (UI can use shorter)

#### Constants
- ✅ **UPPER_SNAKE_CASE**: `OFFICE_IPS`, `PORT`, `TRUST_PROXY`
- ✅ **Environment Variables**: Match `.env` variable names exactly

#### Files & Directories
- ✅ **kebab-case**: `index.js`, `attendance.csv`
- ✅ **Lowercase**: Directory names (`server`, `public`, `logs`)
- ❌ **No Spaces**: Never use spaces in file/directory names

### 2.3 Function Structure
- ✅ **Pure Functions**: Prefer pure functions when possible
- ✅ **Single Responsibility**: Each function should do one thing
- ✅ **Early Returns**: Use early returns for validation/error cases
- ✅ **Async/Await**: Use async/await over Promise chains

### 2.4 Comments
- ✅ **Korean Comments**: Use Korean for business logic explanations
- ✅ **English Comments**: Use English for technical/API documentation
- ✅ **JSDoc**: Add JSDoc comments for public functions (optional but recommended)
- ❌ **No Obvious Comments**: Don't comment self-explanatory code

---

## 📝 Coding Conventions

### 3.1 JavaScript Best Practices

#### Imports
```javascript
// ✅ Good: Grouped imports
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

// ❌ Bad: Mixed styles
const express = require('express');
import cors from 'cors';
```

#### Error Handling
```javascript
// ✅ Good: Explicit error handling
try {
  fs.appendFileSync(logFile, line, { encoding: 'utf8' });
} catch (err) {
  console.error('Failed to write log:', err);
}

// ⚠️ Acceptable: Silent failure for non-critical operations
try { fs.appendFileSync(logFile, line); } catch {}
```

#### IP Address Handling
```javascript
// ✅ Good: Normalize IPv6-mapped IPv4
const ip = req.ip.replace('::ffff:', '');

// ✅ Good: Support both IPv4 and IPv6
if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
  const v4 = addr.toIPv4Address();
  // ... handle IPv4
}
```

### 3.2 File Upload Conventions
- ✅ **Sanitize Filenames**: Remove special characters from employee IDs
- ✅ **Unique Filenames**: Use timestamp + employee ID pattern
- ✅ **File Extension**: Preserve original extension, default to `.jpg`
- ✅ **Cleanup**: Delete temporary files on validation failure

### 3.3 Environment Variables
- ✅ **dotenv**: Always use `dotenv.config()` at the top of server file
- ✅ **Default Values**: Provide sensible defaults (e.g., `PORT || 3000`)
- ✅ **Required Variables**: Document required env vars in README
- ❌ **No Hardcoding**: Never hardcode IPs, ports, or secrets

### 3.4 Path Handling
- ✅ **path.join()**: Always use `path.join()` for file paths
- ✅ **__dirname**: Use `fileURLToPath(import.meta.url)` for ESM `__dirname`
- ✅ **Cross-platform**: Ensure paths work on Windows, Linux, macOS

### 3.5 Frontend Conventions

#### HTML Structure
- ✅ **Semantic HTML**: Use appropriate HTML5 elements
- ✅ **Accessibility**: Include proper labels and ARIA attributes
- ✅ **Mobile-first**: Use viewport meta tag and responsive design

#### JavaScript (Client-side)
- ✅ **Vanilla JS**: No external libraries (use native Fetch API)
- ✅ **Event Listeners**: Use `addEventListener` over inline handlers
- ✅ **Error Messages**: Display user-friendly error messages
- ✅ **Loading States**: Show "전송 중..." during async operations

#### CSS Styling
- ✅ **Inline Styles**: Minimal inline styles (only for dynamic content)
- ✅ **System Fonts**: Use system font stack for performance
- ✅ **Color Classes**: Use semantic class names (`.ok`, `.warn`, `.err`)

---

## 🔒 Security Conventions

### 4.1 Input Validation
- ✅ **Sanitize Input**: Always trim and validate user input
- ✅ **File Validation**: Check file existence before processing
- ✅ **IP Validation**: Validate IP addresses before CIDR matching
- ❌ **No SQL Injection**: Not applicable (no database), but be cautious if adding DB

### 4.2 File Security
- ✅ **Safe Filenames**: Remove special characters from filenames
- ✅ **File Cleanup**: Delete uploaded files on validation failure
- ✅ **Path Traversal**: Use `path.join()` to prevent directory traversal
- ⚠️ **Future**: Add file size limits and MIME type validation

### 4.3 Network Security
- ✅ **CORS**: Configure CORS appropriately (currently open - review for production)
- ✅ **Trust Proxy**: Set `trust proxy` correctly for reverse proxies
- ✅ **IP Whitelist**: Use environment variables for IP whitelist

---

## 📦 Dependency Management

### 5.1 Package Management
- ✅ **npm**: Use npm (not yarn/pnpm) for consistency
- ✅ **Lock File**: Commit `package-lock.json` to version control
- ✅ **Version Pinning**: Use exact versions or `^` for minor updates
- ❌ **No Dev Dependencies**: Currently none, but add if needed (e.g., testing tools)

### 5.2 Dependency Updates
- ⚠️ **Security Updates**: Regularly update dependencies for security patches
- ⚠️ **Breaking Changes**: Test thoroughly before updating major versions
- ✅ **Documentation**: Update README if adding/removing dependencies

---

## 🧪 Testing Conventions (Future)

### 6.1 Test Structure
- ⚠️ **No Tests Yet**: Add tests when project scales
- ✅ **Test Location**: Place tests in `tests/` or `__tests__/` directory
- ✅ **Test Framework**: Consider Jest or Node.js built-in test runner

### 6.2 Test Coverage
- ✅ **Critical Paths**: Test IP validation, file upload, CSV logging
- ✅ **Edge Cases**: Test IPv6, CIDR matching, invalid inputs
- ✅ **Error Handling**: Test error scenarios

---

## 📚 Documentation Conventions

### 7.1 Code Documentation
- ✅ **README.md**: Keep README up-to-date with setup instructions
- ✅ **Inline Comments**: Comment complex logic (IP matching, file handling)
- ✅ **API Documentation**: Document endpoints in README or separate API docs

### 7.2 Commit Messages
- ✅ **Conventional Commits**: Use format `type: description`
  - `feat: add IP validation`
  - `fix: correct path handling on Windows`
  - `docs: update README`
- ✅ **Korean/English**: Use Korean for business features, English for technical changes

---

## 🚀 Deployment Conventions

### 8.1 Environment Setup
- ✅ **Environment Files**: Use `.env` for local development
- ✅ **Example File**: Create `.env.example` (without sensitive data)
- ❌ **No Secrets in Code**: Never commit `.env` files

### 8.2 Production Considerations
- ⚠️ **File Storage**: Migrate to S3/cloud storage for production
- ⚠️ **Database**: Consider database for production (PostgreSQL/SQLite)
- ⚠️ **HTTPS**: Use HTTPS in production (NGINX reverse proxy)
- ⚠️ **Logging**: Add proper logging framework (Winston/Pino)

---

## 🔄 Code Review Checklist

Before submitting code, ensure:
- ✅ Follows naming conventions (camelCase, UPPER_SNAKE_CASE)
- ✅ Uses ESM imports/exports
- ✅ Handles errors appropriately
- ✅ Validates all user inputs
- ✅ Updates documentation if needed
- ✅ Works on Windows, Linux, macOS
- ✅ No hardcoded values (use env vars)

---

## 📌 Quick Reference

### File Structure
```
server/index.js          # Main server file
public/index.html        # Frontend page
server/logs/             # CSV logs (auto-generated)
server/uploads/          # Uploaded photos (auto-generated)
.env                     # Environment variables (not in git)
```

### Key Functions
- `getClientIp(req)`: Extract client IP from request
- `isOfficeIp(ip)`: Check if IP is in whitelist
- `POST /attend/register`: Register attendance
- `GET /ip-status`: Get current IP status

### Environment Variables
- `PORT`: Server port (default: 3000)
- `TRUST_PROXY`: Proxy trust setting (default: 'loopback')
- `OFFICE_IPS`: Comma-separated IP whitelist

---

**Last Updated**: 2025-11-06  
**Version**: 1.0.0

