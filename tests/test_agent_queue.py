import importlib.util
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor

MODULE = Path(__file__).resolve().parents[1] / 'agent_runtime' / 'queue.py'


class QueueTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(MODULE.exists(), 'Persistent agent queue is not implemented')
        spec = importlib.util.spec_from_file_location('agent_queue', MODULE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.queue = module.Queue(Path(self.temp.name) / 'jobs.sqlite', capacity=2, retries=2)

    def test_deduplication_and_restart(self):
        job = self.queue.submit('a', {'task': 'inspect'})
        self.assertEqual(job, self.queue.submit('a', {'task': 'inspect'}))
        reopened = type(self.queue)(self.queue.path, capacity=2, retries=2)
        self.assertEqual(reopened.get(job)['state'], 'queued')
        with self.assertRaises(ValueError): self.queue.submit('a', {'task': 'different'})

    def test_parallel_claims_respect_capacity(self):
        for i in range(12): self.queue.submit(str(i), {'i': i})
        with ThreadPoolExecutor(max_workers=8) as workers:
            claimed = list(workers.map(lambda _: self.queue.claim(now=10), range(8)))
        actual = [x for x in claimed if x]
        self.assertEqual(len(actual), 2)
        self.assertEqual(len({x['id'] for x in actual}), 2)

    def test_stale_worker_cannot_commit(self):
        job = self.queue.submit('a', {})
        old = self.queue.claim(now=10, lease=5)
        new = self.queue.claim(now=16, lease=5)
        self.assertEqual(old['id'], new['id'])
        with self.assertRaises(ValueError): self.queue.finish(job, old['token'], {'ok': True}, now=17)
        self.queue.finish(job, new['token'], {'ok': True}, now=17)
        self.assertEqual(self.queue.get(job)['state'], 'succeeded')

    def test_expired_lease_cannot_commit_without_reclaim(self):
        job = self.queue.submit('a', {})
        claimed = self.queue.claim(now=10, lease=5)
        with self.assertRaises(ValueError): self.queue.finish(job, claimed['token'], {}, now=15)

    def test_retry_exhaustion_is_terminal(self):
        job = self.queue.submit('a', {})
        for now in [10, 16, 22]: self.assertIsNotNone(self.queue.claim(now=now, lease=5))
        self.assertIsNone(self.queue.claim(now=28, lease=5))
        self.assertEqual(self.queue.get(job)['state'], 'failed')
        self.assertEqual(self.queue.get(job)['attempts'], 3)

    def test_finish_is_single_use_and_audited(self):
        job = self.queue.submit('a', {})
        claimed = self.queue.claim(now=10)
        self.queue.finish(job, claimed['token'], {'findings': []}, now=11)
        with self.assertRaises(ValueError): self.queue.finish(job, claimed['token'], {}, now=12)
        events = self.queue.events(job)
        self.assertEqual([x['state'] for x in events], ['queued', 'running', 'succeeded'])
        self.assertEqual(self.queue.get(job)['result'], {'findings': []})

    def test_invalid_input_and_configuration(self):
        with self.assertRaises(ValueError): self.queue.submit('', {})
        with self.assertRaises(ValueError): self.queue.submit('x', {'v': float('nan')})
        with self.assertRaises(ValueError): self.queue.claim(lease=0)
        with self.assertRaises(ValueError): type(self.queue)(self.queue.path, capacity=99, retries=2)


if __name__ == '__main__': unittest.main()
