# MongoDB REST API

Express-like mongodb REST API middleware.

Test coverage: **93%**.

## Install

Via npm:

```bash
npm i mongo-rest-api
```

## Usage

Use as regular middleware:

```
const express = require('express');
const mongodb = require('mongodb');
const mongoRestApi = require('mongo-rest-api');

mondodb.connect()
.then((db) => {
    express()
    .use(mongoRestApi(db))
    .listen();
});

```

## NOTE

**IMPORTANT** Mongo REST API uses `uuid` to generate `_id` for new documents.

## License

MIT.