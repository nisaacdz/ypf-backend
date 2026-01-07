#!/usr/bin/env tsx

/**
 * Test script to validate Swagger spec generation
 */

import { swaggerSpec } from "../configs/docs";

console.log("Testing Swagger spec generation...\n");

// Check basic structure
if (!swaggerSpec) {
  console.error("❌ Swagger spec is undefined");
  process.exit(1);
}

const spec = swaggerSpec as any;

if (!spec.openapi) {
  console.error("❌ OpenAPI version not defined");
  process.exit(1);
}

console.log("✅ OpenAPI version:", spec.openapi);

if (!spec.info) {
  console.error("❌ API info not defined");
  process.exit(1);
}

console.log("✅ API Title:", spec.info.title);
console.log("✅ API Version:", spec.info.version);

// Check components schemas
if (!spec.components?.schemas) {
  console.error("❌ Component schemas not defined");
  process.exit(1);
}

const schemaCount = Object.keys(spec.components.schemas).length;
console.log(`✅ Component schemas loaded: ${schemaCount} schemas`);
console.log("   Schemas:", Object.keys(spec.components.schemas).join(", "));

// Check paths
if (!spec.paths) {
  console.error("❌ Paths not defined");
  process.exit(1);
}

const pathCount = Object.keys(spec.paths).length;
console.log(`✅ Paths loaded: ${pathCount} paths`);
console.log("   Sample paths:");
Object.keys(spec.paths)
  .slice(0, 5)
  .forEach((path) => {
    console.log(`   - ${path}`);
  });

// Check tags
if (!spec.tags) {
  console.error("⚠️  Warning: Tags not defined");
} else {
  console.log(`✅ Tags loaded: ${spec.tags.length} tags`);
}

console.log("\n✅ All tests passed! Swagger spec is valid.");
