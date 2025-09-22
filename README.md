# YPF Core

Rules

1. Modular imports should use the @ annotation for project root as much as possible. e.g. import db from "@/configs/db" instead of import db from "../../configs/db"
2. After using the validateBody and validateQuery middlewares, the validated results will now be req.Body and req.Query respectively (capitalized)
3. No process.env.[VARIABLE_NAME] call. Use env.variableName from @/configs/env
4. Routes and route handlers are in features/api/v1/[segment]/...
5. Route handlers should focus on interactions between utility functions and services in order to return a result of ApiResponse<T> or return an object with a response field of type ApiResponse<T>.
6. Handlers shouldn't accept req and response objects but rather only the necessary objects needed
7. At the route definition, middlewares can be attached and responses can be sent after calling the route handlers.
8. Service utility functions should interact with the database and handle possible errors into AppError
9. Handlers do not need to be wrapped in a try-catch if they simply call service functions and return results.
10. 

DRIZZLE

1. For selecting only one item with a UNIQUE column, consider using the db.query.[TableName].findOne(), instead of the db.select()

PR

1. Before submitting a pull request, make sure that basic tests pass: npm run format, npm run build, npm run lint
2. Aim for smallest amount of file changes for each pr. If possible, consider separating large tasks into multiple prs
3.

ISSUES

1.

Reachout as frequently as you need
