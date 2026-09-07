"""Tests for BullMQ-compatible job queue durability, lease heartbeats, stalled-job watchdog, and Supabase outbox reconciliation."""

from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from mini_run_pipeline import jobs
from mini_run_pipeline import storage


class TestJobQueueDurability(unittest.TestCase):

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.queue_file = Path(self.tmp_dir.name) / "test_queue.json"
        self.queue = jobs.LocalJobQueue(persistence_file=self.queue_file)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_idempotent_enqueue_prevents_duplicates(self):
        """Enqueueing the same jobId twice must not duplicate it in the wait queue."""
        job_id = "test_job_idempotent_1"
        data = {"video": "source.mp4"}

        # First enqueue
        res1 = self.queue.enqueue("render", data, job_id=job_id)
        self.assertEqual(res1, job_id)
        self.assertEqual(self.queue._wait.qsize(), 1)

        # Duplicate enqueue
        res2 = self.queue.enqueue("render", data, job_id=job_id)
        self.assertEqual(res2, job_id)
        # Queue size should still be 1, not 2
        self.assertEqual(self.queue._wait.qsize(), 1)

    def test_completed_job_is_not_requeued(self):
        """If a job is already completed, re-enqueueing it must not reset it to waiting."""
        job_id = "test_job_completed_1"
        self.queue.enqueue("render", {"test": 1}, job_id=job_id)
        popped = self.queue._pop_active()
        self.assertEqual(popped, job_id)
        self.queue._complete(job_id, {"url": "https://r2.test/out.mp4"})

        # Verify completed
        env = self.queue.get(job_id)
        self.assertEqual(env["_state"], "completed")

        # Try to re-enqueue
        re_enqueued = self.queue.enqueue("render", {"test": 2}, job_id=job_id)
        self.assertEqual(re_enqueued, job_id)
        # Still completed
        env_after = self.queue.get(job_id)
        self.assertEqual(env_after["_state"], "completed")
        self.assertEqual(self.queue._wait.qsize(), 0)

    def test_lease_renewal_and_active_lock(self):
        """Active jobs maintain lease heartbeats; get() reports lease status."""
        job_id = "test_job_lease_1"
        self.queue.enqueue("render", {}, job_id=job_id)
        self.queue._pop_active()

        # Just popped -> has active lease
        env = self.queue.get(job_id)
        self.assertEqual(env["_state"], "active")
        self.assertTrue(env["_hasActiveLock"])

        # Release lease (simulate worker cleanup or completion)
        self.queue.release_lease(job_id)
        env_released = self.queue.get(job_id)
        self.assertFalse(env_released["_hasActiveLock"])

    def test_stalled_job_sweeper_reclaims_interrupted_jobs(self):
        """A job whose lease expired (worker died/disconnected) must be reclaimed into wait."""
        job_id = "test_stalled_job_1"
        opts = {"attempts": 3}
        self.queue.enqueue("render", {}, job_id=job_id, opts=opts)
        self.queue._pop_active()

        # Simulate lease expiration (set lease expiry in the past)
        self.queue._active_leases[job_id] = time.time() - 10

        # Run sweeper
        reclaimed = self.queue.sweep_stalled_jobs()
        self.assertIn(job_id, reclaimed)

        # Job must be back in 'waiting' and pushed into wait queue
        env = self.queue.get(job_id)
        self.assertEqual(env["_state"], "waiting")
        self.assertEqual(env["attemptsMade"], 1)
        self.assertEqual(self.queue._wait.qsize(), 1)

    def test_stalled_job_fails_when_max_attempts_exhausted(self):
        """If a stalled job has exhausted its attempt budget, mark it failed."""
        job_id = "test_stalled_exhausted_1"
        opts = {"attempts": 1}
        self.queue.enqueue("render", {}, job_id=job_id, opts=opts)
        self.queue._pop_active()

        # Expire lease
        self.queue._active_leases[job_id] = time.time() - 10

        reclaimed = self.queue.sweep_stalled_jobs()
        self.assertNotIn(job_id, reclaimed)

        env = self.queue.get(job_id)
        self.assertEqual(env["_state"], "failed")
        self.assertIn("stalled", env["failedReason"].lower())

    def test_wal_file_persistence_survives_process_restart(self):
        """LocalJobQueue survives restart: loads jobs from disk and restores interrupted jobs."""
        job_id_1 = "job_restart_waiting"
        job_id_2 = "job_restart_active"

        self.queue.enqueue("render", {"v": 1}, job_id=job_id_1)
        self.queue.enqueue("render", {"v": 2}, job_id=job_id_2)
        # Pop job 2 so it becomes active
        self.queue._pop_active()

        # Ensure file exists on disk
        self.assertTrue(self.queue_file.exists())

        # Simulate crash & new process starting up
        restarted_queue = jobs.LocalJobQueue(persistence_file=self.queue_file)

        # Both jobs should be known
        env1 = restarted_queue.get(job_id_1)
        env2 = restarted_queue.get(job_id_2)
        self.assertIsNotNone(env1)
        self.assertIsNotNone(env2)

        # The active job should be recovered to 'waiting' for a new worker to pick it up
        self.assertEqual(env1["_state"], "waiting")
        self.assertEqual(env2["_state"], "waiting")
        self.assertEqual(restarted_queue._wait.qsize(), 2)


class TestSupabaseStoreResilience(unittest.TestCase):

    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.outbox_file = Path(self.tmp_dir.name) / "test_outbox.jsonl"
        self.store = storage.SupabaseStore(
            env={
                "SUPABASE_URL": "https://fake.supabase.co",
                "SUPABASE_SERVICE_ROLE_KEY": "fake_key",
                "MINI_RUN_OUTBOX_FILE": str(self.outbox_file),
            }
        )

    def tearDown(self):
        self.tmp_dir.cleanup()

    @patch("urllib.request.urlopen")
    def test_transient_retry_on_network_error(self, mock_urlopen):
        """Transient HTTP 503 error succeeds on subsequent attempt."""
        import urllib.error

        # Fail once with HTTP 503, succeed on second attempt
        error_resp = urllib.error.HTTPError(
            url="https://fake.supabase.co",
            code=503,
            msg="Service Unavailable",
            hdrs=None,
            fp=None,
        )
        mock_success = MagicMock()
        payload_bytes = json.dumps([{"id": "job_1", "status": "processing"}]).encode("utf-8")
        mock_success.read.return_value = payload_bytes
        mock_success.__enter__.return_value.read.return_value = payload_bytes
        mock_urlopen.side_effect = [error_resp, mock_success]

        result = self.store._request("PATCH", "?id=eq.job_1", {"status": "processing"}, retries=2)
        self.assertEqual(result, [{"id": "job_1", "status": "processing"}])
        self.assertEqual(mock_urlopen.call_count, 2)

    @patch("urllib.request.urlopen", side_effect=TimeoutError("Network dropped"))
    def test_offline_outbox_buffering(self, mock_urlopen):
        """When network is completely down, updates are buffered to local JSONL outbox."""
        job_id = "job_offline_1"
        updates = {"status": "completed", "progress": 100}

        # update_job should catch error and buffer to outbox without raising
        res = self.store.update_job(job_id, updates)
        self.assertIsNone(res)

        # Verify outbox file was written
        self.assertTrue(self.outbox_file.exists())
        content = self.outbox_file.read_text("utf-8")
        lines = [json.loads(l) for l in content.splitlines() if l.strip()]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["job_id"], job_id)
        self.assertEqual(lines[0]["payload"]["status"], "completed")

    @patch("urllib.request.urlopen")
    def test_flush_outbox_replays_buffered_updates(self, mock_urlopen):
        """When connection is restored, flush_outbox replays buffered operations."""
        # Pre-seed outbox with 2 buffered updates
        records = [
            {"op": "update", "job_id": "job_buf_1", "payload": {"progress": 50}, "timestamp": time.time()},
            {"op": "update", "job_id": "job_buf_2", "payload": {"status": "completed"}, "timestamp": time.time()},
        ]
        self.outbox_file.write_text("\n".join(json.dumps(r) for r in records) + "\n", encoding="utf-8")

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps([{"ok": True}]).encode("utf-8")
        mock_urlopen.return_value = mock_resp

        flushed = self.store.flush_outbox()
        self.assertEqual(flushed, 2)
        # Outbox file should be cleaned up after all items flushed
        self.assertFalse(self.outbox_file.exists())


class TestGatewayAsyncLongform(unittest.TestCase):

    @patch("mini_run_pipeline.longform_pipeline.execute_longform_batch_from_payload")
    def test_gateway_longform_async_immediate_return(self, mock_exec):
        from mini_run_gateway import handle_longform_batch

        mock_exec.return_value = {"batchId": "b1", "success": True}

        payload = {
            "source": {"path": "/fake/video.mp4"},
            "nClips": 3,
            "jobIdPrefix": "test_batch_prefix_1",
            "sync": False,
        }

        # Should return immediately with status='queued' and batchJobId
        res = handle_longform_batch(payload)
        self.assertEqual(res["batchJobId"], "test_batch_prefix_1")
        self.assertEqual(res["status"], "queued")
        self.assertEqual(res["nClips"], 3)
        self.assertIn("pollUrl", res)


if __name__ == "__main__":
    unittest.main()
