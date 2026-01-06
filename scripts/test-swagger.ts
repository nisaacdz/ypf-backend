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

if (!swaggerSpec.openapi) {
  console.error("❌ OpenAPI version not defined");
  process.exit(1);
}

console.log("✅ OpenAPI version:", swaggerSpec.openapi);

if (!swaggerSpec.info) {
  console.error("❌ API info not defined");
  process.exit(1);
}

console.log("✅ API Title:", swaggerSpec.info.title);
console.log("✅ API Version:", swaggerSpec.info.version);

// Check components schemas
if (!swaggerSpec.components?.schemas) {
  console.error("❌ Component schemas not defined");
  process.exit(1);
}

const schemaCount = Object.keys(swaggerSpec.components.schemas).length;
console.log(`✅ Component schemas loaded: ${schemaCount} schemas`);
console.log("   Schemas:", Object.keys(swaggerSpec.components.schemas).join(", "));

// Check paths
if (!swaggerSpec.paths) {
  console.error("❌ Paths not defined");
  process.exit(1);
}

const pathCount = Object.keys(swaggerSpec.paths).length;
console.log(`✅ Paths loaded: ${pathCount} paths`);
console.log("   Sample paths:");
Object.keys(swaggerSpec.paths).slice(0, 5).forEach((path) => {
  console.log(`   - ${path}`);
});

// Check tags
if (!swaggerSpec.tags) {
  console.error("⚠️  Warning: Tags not defined");
} else {
  console.log(`✅ Tags loaded: ${swaggerSpec.tags.length} tags`);
}

console.log("\n✅ All tests passed! Swagger spec is valid.");
