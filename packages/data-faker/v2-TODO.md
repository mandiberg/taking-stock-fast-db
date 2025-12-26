# Data Faker v2 - Generic Schema Support

## Goal

Make the data faker accept any Moose `OlapTable` instance and automatically generate test data based on its TypeScript schema, while preserving custom field generators for specific fields.

## Architecture

### Type Introspection Approach

- Import the Moose `OlapTable` instance (e.g., `imagesAnalytical` from `packages/moosestack-service/app/ingest/models.ts`)
- Use TypeScript's type system to introspect the generic type parameter `<T>` from `OlapTable<T>`
- Extract field names and types from the interface/type definition
- Map TypeScript types to ClickHouse types using MooseStack's documented mappings

### Type Mapping Strategy

Based on MooseStack documentation (`context/framework-docs-v2/content/moosestack/data-types/`):

**Basic Types:**
- `string` → `String` (generate random strings)
- `number` → `Float64` (generate random floats)
- `boolean` → `Boolean` (generate random booleans)
- `Date` → `DateTime` (generate random dates)
- `Int8`, `Int16`, `Int32`, `Int64`, `UInt8`, `UInt16`, `UInt32`, `UInt64` → Respective integer types (generate random integers in range)

**Complex Types:**
- `T[]` → `Array(T)` (generate arrays of random length with random elements)
- `LowCardinality(String)` → Detect via type metadata, generate from limited pool
- `Record<K, V>` → `Map(K, V)` (generate maps with random keys/values)
- `Decimal(P, S)` → Generate decimal values within precision
- `Nullable<T>` → Optional fields, generate null ~10% of the time

**Special Handling:**
- `Key<T>` → Primary key, generate sequential or UUID values
- Fields ending in `_id` → Generate integer IDs (0-10000 range)
- Fields ending in `_ids` → Generate array of IDs
- Fields named `updated_at`, `created_at` → Generate timestamps
- Fields named `*_date` → Generate dates

### Custom Field Generators

Preserve the existing custom generator system:

- **Field-specific generators**: Allow registering custom generators for specific field names (e.g., `caption` → mad libs generator)
- **Pattern-based generators**: Support regex patterns for field names (e.g., `*_cluster_*` → cluster ID generator)
- **Type-based generators**: Override default generators for specific types (e.g., all `string[]` fields → custom array generator)

**Configuration Format:**
```typescript
interface FieldGeneratorConfig {
  fieldName?: string;           // Exact field name match
  fieldPattern?: RegExp;        // Regex pattern for field names
  type?: string;               // TypeScript type name
  generator: (rng: () => number, rowIndex: number) => any;
}
```

### Implementation Plan

1. **Type Introspection Module** (`src/schema-introspection.ts`):
   - Function to extract type information from `OlapTable<T>` instance
   - Use TypeScript compiler API or runtime type metadata
   - Return schema metadata: field names, types, nullable flags

2. **Type-to-Generator Mapping** (`src/type-generators.ts`):
   - Default generators for each TypeScript type
   - Configurable generators registry
   - Support for custom field generators

3. **Generic Row Generator** (`src/generic-generator.ts`):
   - Accept `OlapTable` instance and optional field generator config
   - Generate rows matching the schema
   - Preserve deterministic generation (seed-based)

4. **CLI Updates** (`src/index.ts`):
   - Add `--table <path>` option to specify OlapTable import path
   - Add `--config <file>` option for custom field generator config
   - Maintain backward compatibility with current `ImagesAnalytical` approach

### Complex Type Handling

**Arrays (`T[]`):**
- Generate random length (0-10 elements by default, configurable)
- Generate elements using the element type's generator
- For `number[]`: Generate array of random numbers
- For `string[]`: Generate array of random strings
- For `Int32[]`: Generate array of random integers

**LowCardinality Strings:**
- Detect via type metadata or field name patterns
- Generate from a limited pool of values (10-100 unique values)
- Use weighted distribution for realistic data

**Maps (`Record<K, V>`):**
- Generate 0-5 key-value pairs
- Generate keys using key type generator
- Generate values using value type generator

**Nested Types:**
- Support nested objects/interfaces
- Recursively generate nested fields
- Handle nullable nested types

**Enums:**
- Extract enum values from TypeScript enum type
- Generate random enum values

### Migration Path

- Keep current `ImagesAnalytical`-specific code as default/fallback
- Add new generic mode as opt-in via CLI flag
- Gradually migrate custom generators to config-based system
- Maintain checkpoint compatibility

### Files to Create/Modify

**New Files:**
- `packages/data-faker/src/schema-introspection.ts` - Type introspection logic
- `packages/data-faker/src/type-generators.ts` - Default type generators
- `packages/data-faker/src/generic-generator.ts` - Generic row generator
- `packages/data-faker/src/generator-config.ts` - Field generator config types

**Modified Files:**
- `packages/data-faker/src/index.ts` - Add CLI options for v2 mode
- `packages/data-faker/src/generator.ts` - Refactor to support both modes
- `packages/data-faker/README.md` - Document v2 features

### Challenges & Considerations

1. **TypeScript Runtime Type Introspection:**
   - TypeScript types are erased at runtime
   - Need to use TypeScript compiler API or decorators/metadata
   - Alternative: Require schema metadata file alongside table definition

2. **Custom Generator Compatibility:**
   - Existing custom generators (`captions.ts`, `distributions.ts`) need to work with generic system
   - May need adapter layer to map field names to generators

3. **Performance:**
   - Generic type checking may be slower than hardcoded generation
   - Consider caching schema metadata

4. **Type Safety:**
   - Generated data must match ClickHouse schema exactly
   - Need validation layer to ensure compatibility

### Testing Strategy

- Test with `ImagesAnalytical` table (existing schema)
- Test with simple schemas (few fields, basic types)
- Test with complex schemas (arrays, nested, maps)
- Test custom field generators
- Benchmark performance vs current implementation

### Success Criteria

- Can generate data for any `OlapTable` without code changes
- Custom field generators work seamlessly
- Performance is comparable to current implementation
- Backward compatible with existing usage
- Well-documented and easy to use

