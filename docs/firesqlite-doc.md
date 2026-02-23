## firesqlite

`firesqlite` provides a small Firestore-like API backed by `wa-sqlite` and OPFS.
It exposes a familiar surface (initialize, `collection`/`doc`, queries, and
`onSnapshot`) so you can prototype Firestore-style code that persistence in the
browser's OPFS via `wa-sqlite`.

Quick start
-----------

Install (for consuming as a package):

```
npm install firesqlite
```

Build locally (library):

```
npm run build:lib
```

Run the example app (dev server):

```
npx vite example
```

API overview
------------

Import the public API from the package root:

```ts
import {
  initializeFirestoreSQLite,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  deleteDoc
} from 'firesqlite';
```

Initialize the DB before using other functions:

```ts
await initializeFirestoreSQLite('my-db-name');
const db = getFirestore();
```

Simple query example
--------------------

```ts
const kv = collection(db, 'kv_store');
const q = query(kv, orderBy('key', 'asc'));
const snapshot = await getDocs(q);
const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
```

Snapshot example (real-time-like)
--------------------------------

```ts
const unsub = onSnapshot(q, snapshot => {
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('snapshot', items);
});

// later when you want to stop listening
unsub();
```

CRUD helpers
------------

```ts
// set / upsert
await setDoc(doc(db, 'kv_store', 'myKey'), { value: 'hello' });

// delete
await deleteDoc(doc(db, 'kv_store', 'myKey'));
```

Notes
-----

- The package builds both ESM (`dist/index.js`) and CJS (`dist/index.cjs`).
- Worker code uses `import.meta.url` and works best for ESM consumers. CJS
  consumers may receive an empty `import.meta` value for worker-related paths.
- See `example/` for a working demo of the UI and the worker integration.

Contributing
------------

Persistence implementation
-------------------------

Internally `firesqlite` uses `wa-sqlite` and an OPFS-backed VFS to persist
documents in the browser. Key implementation details:

- The worker (`src/lib/firestore-sqlite/worker.ts`) initializes `wa-sqlite`
  and registers `OriginPrivateFileSystemVFS` so the SQLite file lives in the
  Origin Private File System (OPFS).
- Documents are stored in a table named `documents` with schema:

  ```sql
  CREATE TABLE IF NOT EXISTS documents (
    collection_id TEXT,
    doc_id TEXT,
    data TEXT,
    PRIMARY KEY (collection_id, doc_id)
  )
  ```

- Document JSON is stored as stringified JSON in the `data` column. Queries
  use SQLite's `json_extract` and `json_each` helpers to evaluate fields and
  array-contains semantics.
- Indexes are created via `createIndex()` which creates SQLite indexes on
  `json_extract(data, '$.<field>')` limited to the collection via a WHERE
  clause.
- Batches are executed inside a transaction using `BEGIN TRANSACTION` /
  `COMMIT` / `ROLLBACK` so multiple operations are atomic.
- The library exposes a lightweight event emitter (internal `mitt` instance)
  that notifies listeners when collections change. `onSnapshot()` subscribes
  to these events and transforms rows into a Firestore-like snapshot with
  `docs` and `docChanges()`.
- Special helpers: `serverTimestamp()` is supported and expanded on write to
  an ISO timestamp; `expandDotNotation()` supports field paths like
  `a.b.c` when writing.

Examples
--------

See the `example/` app for a working demonstration of the UI and the worker
integration. The library docs and code examples above show how to initialize
the DB, query, and subscribe to snapshots.
