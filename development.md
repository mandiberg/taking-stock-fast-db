# Development Guide

## Data Ingestion API

Ingest data via POST requests to `http://localhost:4000/ingest/{TableName}`. For example:

```bash
curl -X POST http://localhost:4000/ingest/Images \
  -H "Content-Type: application/json" \
  -d '{"image_id": 1, "site_name_id": 1, ...}'
```

## Data Models

Data models are defined in `packages/moosestack-service/app/ingest/models.ts`. Key tables include:

- **Images** - Core image metadata (site, author, caption, URLs, dimensions)
- **Encodings** - Face/body detection flags, orientation, landmark presence
- **Demographics** - Age, Gender, Ethnicity, Location lookup tables
- **Clusters** - Body pose, hand position, HSV color clusters at various granularities
