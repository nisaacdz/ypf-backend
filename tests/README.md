# Test Suite Documentation

## Overview

This test suite uses:

- **Vitest**: Fast test framework with TypeScript support
- **Supertest**: HTTP assertion library for testing API endpoints
- **pg-mem**: In-memory PostgreSQL database for isolated testing

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests and generate coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```
