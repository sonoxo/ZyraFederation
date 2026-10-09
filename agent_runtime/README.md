# Persistent agent queue

This standard-library Python module adds bounded concurrent work, restart recovery,
deduplication, lease fencing, retry limits, and an append-only transition history.
It is infrastructure for future agent workflows; it does not invoke an LLM or
implement a code-review engine.

```python
from agent_runtime.queue import Queue

queue = Queue('jobs.sqlite', capacity=4, retries=2)
job_id = queue.submit('review:commit-sha', {'task': 'review', 'commit': 'commit-sha'})
job = queue.claim(lease=60)
if job:
    # Perform your own bounded task here, then record its actual result.
    queue.finish(job['id'], job['token'], {'example': True})
```

Run several worker processes against the same database on one host. SQLite write
transactions serialize claims so the persisted capacity applies across workers.
All processes must use identical capacity and retry settings. A task progresses
from `queued` to `running` to `succeeded`. On the next claim after a lease expires,
it returns to `queued`, or becomes `failed` after the initial attempt plus the
configured retries. Exceptions in worker code must be handled by the caller;
an unfinished job is recovered after its lease expires.

Use a lease longer than the task's maximum runtime. There is no heartbeat or
task cancellation yet. Expired workers cannot store results, but may still be
executing: capacity bounds valid leases, not surviving processes. Processing is
at least once; external side effects need their own idempotency controls.

Use a local disk, a trusted host, and a stable system clock. This is not a
multi-host cluster, a network API, or a production readiness certification.
Authentication, monitoring, retention, schema migrations, backups, and load
benchmarks remain deployment work. Job count and audit history are unbounded;
payloads and results are limited to 64 KiB each. Do not store secrets in jobs.

The design relates conceptually to explicit state tracking described in
[US20250110753A1](https://patents.google.com/patent/US20250110753A1/en),
*State machine backed llm agents*. It is not an implementation of all patent
claims or a determination of licensing rights.

Verify from the repository root:

```sh
python3 -m unittest discover -s tests -p 'test_agent_queue.py'
node --test tests/*.test.mjs
```
