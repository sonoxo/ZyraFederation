"""Durable, bounded, single-host worker queue using Python's standard library."""
from contextlib import contextmanager
import json
import math
from pathlib import Path
import sqlite3
import time
import uuid


def encode(value):
    data = json.dumps(value, sort_keys=True, allow_nan=False, separators=(',', ':'))
    if len(data.encode()) > 65536:
        raise ValueError('JSON payload exceeds 64 KiB')
    return data


def timestamp(value):
    value = time.time() if value is None else float(value)
    if not math.isfinite(value):
        raise ValueError('Time must be finite')
    return value


class Queue:
    def __init__(self, path, capacity=4, retries=2):
        if type(capacity) is not int or not 1 <= capacity <= 1024:
            raise ValueError('capacity must be an integer between 1 and 1024')
        if type(retries) is not int or not 0 <= retries <= 100:
            raise ValueError('retries must be an integer between 0 and 100')
        self.path = Path(path)
        with self.transaction() as db:
            db.execute('CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK(id=1), capacity INTEGER, retries INTEGER)')
            db.execute('INSERT OR IGNORE INTO config VALUES (1, ?, ?)', (capacity, retries))
            settings = db.execute('SELECT capacity, retries FROM config').fetchone()
            if tuple(settings) != (capacity, retries):
                raise ValueError('Queue configuration conflicts with persisted settings')
            db.execute('''CREATE TABLE IF NOT EXISTS jobs (
                seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
                dedupe TEXT UNIQUE NOT NULL, payload TEXT NOT NULL,
                state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                lease_until REAL, token TEXT, result TEXT)''')
            db.execute('CREATE INDEX IF NOT EXISTS jobs_state ON jobs(state, seq)')
            db.execute('''CREATE TABLE IF NOT EXISTS events (
                seq INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT NOT NULL,
                state TEXT NOT NULL, at REAL NOT NULL)''')
        self.capacity, self.retries = capacity, retries

    @contextmanager
    def transaction(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            db.execute('BEGIN IMMEDIATE')
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def event(db, job, state, now):
        db.execute('INSERT INTO events(job, state, at) VALUES (?, ?, ?)', (job, state, now))

    def submit(self, key, payload):
        if not isinstance(key, str) or not key.strip() or len(key) > 256:
            raise ValueError('A nonempty deduplication key of at most 256 characters is required')
        payload = encode(payload)
        with self.transaction() as db:
            previous = db.execute('SELECT id, payload FROM jobs WHERE dedupe=?', (key,)).fetchone()
            if previous:
                if previous['payload'] != payload:
                    raise ValueError('Deduplication key already identifies a different payload')
                return previous['id']
            job = uuid.uuid4().hex
            db.execute("INSERT INTO jobs(id, dedupe, payload, state) VALUES (?, ?, ?, 'queued')", (job, key, payload))
            self.event(db, job, 'queued', time.time())
            return job

    def claim(self, now=None, lease=60):
        now = timestamp(now)
        lease = float(lease)
        if not math.isfinite(lease) or lease <= 0 or not math.isfinite(now + lease):
            raise ValueError('Lease must be positive and finite')
        with self.transaction() as db:
            expired = db.execute("SELECT id, attempts FROM jobs WHERE state='running' AND lease_until<=?", (now,)).fetchall()
            for job in expired:
                state = 'failed' if job['attempts'] >= self.retries + 1 else 'queued'
                db.execute('UPDATE jobs SET state=?, token=NULL, lease_until=NULL WHERE id=?', (state, job['id']))
                self.event(db, job['id'], state, now)
            running = db.execute("SELECT COUNT(*) FROM jobs WHERE state='running'").fetchone()[0]
            if running >= self.capacity:
                return None
            job = db.execute("SELECT id FROM jobs WHERE state='queued' ORDER BY seq LIMIT 1").fetchone()
            if job is None:
                return None
            token = uuid.uuid4().hex
            db.execute("UPDATE jobs SET state='running', attempts=attempts+1, token=?, lease_until=? WHERE id=?", (token, now + lease, job['id']))
            self.event(db, job['id'], 'running', now)
            return self.decode(db.execute('SELECT * FROM jobs WHERE id=?', (job['id'],)).fetchone())

    def finish(self, job, token, result, now=None):
        now, result = timestamp(now), encode(result)
        with self.transaction() as db:
            updated = db.execute("""UPDATE jobs SET state='succeeded', result=?, token=NULL,
                lease_until=NULL WHERE id=? AND token=? AND state='running' AND lease_until>?""",
                (result, job, token, now))
            if updated.rowcount != 1:
                raise ValueError('Worker lease is stale, expired, or already completed')
            self.event(db, job, 'succeeded', now)

    @staticmethod
    def decode(row):
        if row is None:
            return None
        value = dict(row)
        value['payload'] = json.loads(value['payload'])
        value['result'] = json.loads(value['result']) if value['result'] is not None else None
        return value

    def get(self, job):
        with self.transaction() as db:
            return self.decode(db.execute('SELECT * FROM jobs WHERE id=?', (job,)).fetchone())

    def events(self, job):
        with self.transaction() as db:
            return [dict(row) for row in db.execute('SELECT state, at FROM events WHERE job=? ORDER BY seq', (job,))]
