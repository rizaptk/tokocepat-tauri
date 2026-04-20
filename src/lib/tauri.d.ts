/**
 * FireLite Ambient Type Definitions
 * Version: 0.6.19
 */

declare module '@/lib/firelite' {
    
    // --- Basic Data Types ---
    export type FireLitePrimitive = 
      | string | number | boolean | null | Uint8Array | Date
      | { [key: string]: FireLitePrimitive } 
      | FireLitePrimitive[];

    export type FireLiteRecord = Record<string, any>;

    export type FilterOperator = 
      | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' 
      | 'match' | 'contains' | 'startsWith' | 'in' | 'notIn' 
      | 'arrayContains' | 'arrayContainsAny' | '==' | '!=' | '>' | '>=' | '<' | '<=';

    export type AggregateKind = 'count' | 'sum' | 'avg';

    export interface SetOptions {
        merge?: boolean;
    }

    export interface AuditEntry {
        op: string;
        collection: string;
        doc_id?: string;
        ok: boolean;
    }

    // --- References ---
    export class FireLite {}

    export class DocumentReference<T = FireLiteRecord> {
        readonly collectionPath: string;
        readonly id: string;
        readonly path: string;
        constructor(collectionPath: string, id: string);
    }

    export class CollectionReference<T = FireLiteRecord> {
        readonly type: 'collection';
        readonly path: string;
        constructor(path: string);
    }

    export class CollectionGroupReference<T = FireLiteRecord> {
        readonly type: 'collectionGroup';
        readonly id: string;
        constructor(id: string);
    }

    // --- Snapshots ---
    export class DocumentSnapshot<T = FireLiteRecord> {
        readonly id: string;
        readonly createTime?: number; // Logic time in microseconds
        constructor(id: string, exists: boolean, data?: T, ref?: DocumentReference<T>);
        exists(): boolean;
        data(): T | undefined;
        get ref(): DocumentReference<T>;
    }

    export interface DocumentChange<T = FireLiteRecord> {
        type: 'added' | 'modified' | 'removed';
        doc: DocumentSnapshot<T>;
    }

    export class QuerySnapshot<T = FireLiteRecord> {
        readonly docs: DocumentSnapshot<T>[];
        readonly empty: boolean;
        readonly size: number;
        constructor(docs: DocumentSnapshot<T>[], changes?: DocumentChange<T>[]);
        docChanges(): DocumentChange<T>[];
        forEach(callback: (doc: DocumentSnapshot<T>) => void): void;
    }

    // --- Queries ---
    export type QueryConstraintType = 'where' | 'order_by' | 'limit' | 'offset' | 'select' | 'start_at' | 'start_after' | 'end_at' | 'end_before' | 'or';

    export class QueryConstraint {
        readonly type: QueryConstraintType;
        readonly data: any;
        constructor(type: QueryConstraintType, data: any);
    }

    export class Query<T = FireLiteRecord> {
        readonly type: 'query';
        readonly colRef: CollectionReference<T> | CollectionGroupReference<T>;
        readonly constraints: QueryConstraint[];
        constructor(colRef: CollectionReference<T> | CollectionGroupReference<T>, constraints?: QueryConstraint[]);
    }

    // --- Top Level Functions ---
    export const getFirestore: () => FireLite;

    export const collection: <T = FireLiteRecord>(db: FireLite, path: string) => CollectionReference<T>;

    export const doc: <T = FireLiteRecord>(
        db: FireLite, 
        colOrPath: string | CollectionReference<T>, 
        id?: string
    ) => DocumentReference<T>;

    // --- CRUD Operations ---
    export const addDoc: <T = FireLiteRecord>(colRef: CollectionReference<T>, data: T) => Promise<DocumentReference<T>>;
    export const setDoc: <T = FireLiteRecord>(ref: DocumentReference<T>, data: T, options?: SetOptions) => Promise<void>;
    export const updateDoc: <T = FireLiteRecord>(ref: DocumentReference<T>, data: Partial<T>) => Promise<void>;
    export const deleteDoc: (ref: DocumentReference<any>) => Promise<void>;
    export const getDoc: <T = FireLiteRecord>(ref: DocumentReference<T>) => Promise<DocumentSnapshot<T>>;

    // --- Mass Operations ---
    export const updateDocs: <T = FireLiteRecord>(q: Query<T>, data: Partial<T>) => Promise<{ updated: number }>;
    export const deleteDocs: (q: Query<any>) => Promise<{ deleted: number }>;

    // --- Querying ---
    export const query: <T = FireLiteRecord>(
        colRef: CollectionReference<T> | CollectionGroupReference<T>, 
        ...constraints: QueryConstraint[]
    ) => Query<T>;

    export const where: (field: string, op: FilterOperator, value: any) => QueryConstraint;
    export const or: (...constraints: QueryConstraint[]) => QueryConstraint;
    export const orderBy: (field: string, direction?: 'asc' | 'desc') => QueryConstraint;
    export const limit: (n: number) => QueryConstraint;
    export const offset: (n: number) => QueryConstraint;
    export const select: (...fields: string[]) => QueryConstraint;
    export const startAt: (...values: any[]) => QueryConstraint;
    export const startAfter: (...values: any[]) => QueryConstraint;
    export const endAt: (...values: any[]) => QueryConstraint;
    export const endBefore: (...values: any[]) => QueryConstraint;

    export const getDocs: <T = FireLiteRecord>(q: Query<T> | CollectionReference<T>) => Promise<QuerySnapshot<T>>;

    // --- Realtime Listeners ---
    export function onSnapshot<T = FireLiteRecord>(
        ref: DocumentReference<T>,
        onNext: (snapshot: DocumentSnapshot<T>) => void,
        onError?: (error: any) => void
    ): () => void;
    
    export function onSnapshot<T = FireLiteRecord>(
        ref: Query<T> | CollectionReference<T>,
        onNext: (snapshot: QuerySnapshot<T>) => void,
        onError?: (error: any) => void
    ): () => void;

    // --- Aggregations ---
    export const getCountFromServer: (q: Query<any> | CollectionReference<any>) => Promise<{ data: () => { count: number } }>;
    export const getSumFromServer: (q: Query<any> | CollectionReference<any>, field: string) => Promise<{ data: () => { value: number } }>;
    export const getAverageFromServer: (q: Query<any> | CollectionReference<any>, field: string) => Promise<{ data: () => { value: number } }>;

    // --- Admin Functions ---
    export const listCollections: () => Promise<string[]>;
    export const getStats: () => Promise<Record<string, number>>;
    export const setDurability: (mode: 'always' | 'interval' | 'manual' | 'on_commit') => Promise<void>;
    export const setCompression: (enabled: boolean, level?: number) => Promise<void>;
    export const getAuditLog: () => Promise<AuditEntry[]>;
}