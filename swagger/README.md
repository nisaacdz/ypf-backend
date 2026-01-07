# Swagger Documentation Structure

This document explains the new YAML-based Swagger documentation structure for the YPF Backend API.

## Overview

API documentation is now separated from route implementation files and stored in the `/swagger` directory as YAML files. This provides:

- **Cleaner Code**: Route files focus on logic, not documentation
- **Better Maintainability**: Documentation is easier to find and update
- **Less Verbosity**: Route files are 70%+ smaller
- **Centralized Management**: All API docs in one location

## Directory Structure

```
swagger/
├── components/
│   └── schemas.yaml       # Reusable component schemas (Error, Medium, Event, etc.)
└── paths/
    ├── dashboard.yaml     # Dashboard endpoint documentation
    ├── events.yaml        # Events endpoint documentation
    ├── projects.yaml      # Projects endpoint documentation
    └── ...                # Other endpoint documentation files
```

## How It Works

### 1. YAML Documentation Files

Each feature's endpoints are documented in a separate YAML file:

**Example: `swagger/paths/dashboard.yaml`**

```yaml
/api/v1/dashboard/stats:
  get:
    summary: Get dashboard statistics
    tags: [Dashboard]
    security:
      - cookieAuth: []
    responses:
      200:
        description: Dashboard statistics retrieved successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                data:
                  type: object
                  # ... schema details
```

### 2. Component Schemas

Reusable schemas are defined in `swagger/components/schemas.yaml`:

```yaml
Error:
  type: object
  properties:
    success:
      type: boolean
      example: false
    message:
      type: string

Event:
  type: object
  properties:
    id:
      type: string
      format: uuid
    name:
      type: string
    # ... other properties
```

### 3. Automatic Loading

The configuration in `configs/docs.ts` automatically:

- Loads all YAML files from `swagger/components/` and `swagger/paths/`
- Merges them into the OpenAPI specification
- Generates the final Swagger documentation

## Adding New Documentation

### For a New Endpoint

1. **Create or update the YAML file** in `swagger/paths/`:
   - One file per feature (e.g., `members.yaml`, `donations.yaml`)
   - Use the path as the key (e.g., `/api/v1/members`)

2. **Define the endpoint**:

   ```yaml
   /api/v1/feature/endpoint:
     get:
       summary: Brief description
       tags: [FeatureName]
       parameters: [...]
       responses: [...]
   ```

3. **Reference schemas** when needed:
   ```yaml
   schema:
     $ref: "#/components/schemas/Event"
   ```

### For a New Schema

Add it to `swagger/components/schemas.yaml`:

```yaml
MyNewSchema:
  type: object
  properties:
    field:
      type: string
```

## Migration Guide

To migrate an existing route from JSDoc to YAML:

### Before (in route file):

```typescript
/**
 * @swagger
 * /api/v1/resource:
 *   get:
 *     summary: Get resource
 *     tags: [Resource]
 *     ...
 */
router.get("/", handler);
```

### After:

1. **Remove** the `@swagger` comment from the route file
2. **Create** `swagger/paths/resource.yaml` with:
   ```yaml
   /api/v1/resource:
     get:
       summary: Get resource
       tags: [Resource]
       # ... rest of documentation
   ```

## Testing Documentation

Run the test script to validate the Swagger spec:

```bash
npm run script test-swagger
```

This verifies:

- ✅ OpenAPI version is defined
- ✅ API info (title, version) is present
- ✅ Component schemas are loaded
- ✅ Paths are loaded
- ✅ Tags are defined

## Viewing Documentation

Start the development server and visit:

```
http://localhost:8000/docs
```

The Swagger UI will display all documentation from both YAML files and any remaining JSDoc comments.

## Benefits

### Reduced Route File Sizes

- Dashboard: 137 → 36 lines (73% reduction)
- Events: 573 → 169 lines (71% reduction)
- Projects: 675 → 187 lines (72% reduction)

### Improved Developer Experience

- Easier to find and update documentation
- No more scrolling through massive route files
- YAML syntax is cleaner and more readable than JSDoc
- Better separation of concerns

### Backwards Compatibility

The system still supports JSDoc `@swagger` comments in TypeScript files, allowing for gradual migration.

## Best Practices

1. **One file per feature**: Group related endpoints in the same YAML file
2. **Use schema references**: Define schemas once in `schemas.yaml` and reference them
3. **Consistent formatting**: Follow OpenAPI 3.0 specification
4. **Test after changes**: Run `npm run script test-swagger` to validate
5. **Keep synchronized**: Ensure YAML docs match actual route implementations
