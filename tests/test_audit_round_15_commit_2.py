import unittest


def evaluate_circuit_breaker(policy_report: dict) -> tuple[str, bool, list]:
    """Mirror the circuit breaker logic in .github/scripts/gha_stitch.py."""
    critical_checks = ["safeRegionBounds", "textVisibility", "captionCollision", "cranialHaloGuard", "headOcclusion"]
    failed_critical = [
        k for k in critical_checks
        if isinstance((policy_report.get("checks") or {}).get(k), dict)
        and (policy_report.get("checks") or {}).get(k, {}).get("status") == "failed"
    ]
    has_critical_failure = bool(policy_report.get("status") == "failed" or failed_critical)
    status = "failed" if has_critical_failure else "completed"
    return status, has_critical_failure, failed_critical


class TestAuditRound15Commit2(unittest.TestCase):
    def test_circuit_breaker_trips_on_failed_policy_report(self):
        """Verify that overall policyReport status failed trips the circuit breaker."""
        report = {
            "status": "failed",
            "checks": {
                "safeRegionBounds": {"status": "failed", "violations": ["Frame bleed"]},
                "lineCount": {"status": "passed"},
            },
            "violations": ["Frame bleed"],
        }
        status, tripped, failed_critical = evaluate_circuit_breaker(report)
        self.assertEqual(status, "failed")
        self.assertTrue(tripped)
        self.assertIn("safeRegionBounds", failed_critical)

    def test_circuit_breaker_trips_on_critical_check_failure(self):
        """Verify that any critical check failure trips even if overall status is missing."""
        report = {
            "status": "inconclusive",
            "checks": {
                "textVisibility": {"status": "failed", "violations": ["Chunk occluded"]},
                "cranialHaloGuard": {"status": "passed"},
            },
            "violations": ["Chunk occluded"],
        }
        status, tripped, failed_critical = evaluate_circuit_breaker(report)
        self.assertEqual(status, "failed")
        self.assertTrue(tripped)
        self.assertEqual(failed_critical, ["textVisibility"])

    def test_circuit_breaker_passes_when_clean(self):
        """Verify that when all policy checks pass, the stitch status is completed."""
        report = {
            "status": "passed",
            "checks": {
                "safeRegionBounds": {"status": "passed"},
                "textVisibility": {"status": "passed"},
                "captionCollision": {"status": "passed"},
                "cranialHaloGuard": {"status": "passed"},
                "headOcclusion": {"status": "passed"},
            },
            "violations": [],
        }
        status, tripped, failed_critical = evaluate_circuit_breaker(report)
        self.assertEqual(status, "completed")
        self.assertFalse(tripped)
        self.assertEqual(len(failed_critical), 0)


if __name__ == "__main__":
    unittest.main()
