from sig.core.audit import log_event, read_audit_log


class TestAudit:
    def test_logs_and_reads_events(self, tmp_path):
        sig_dir = str(tmp_path)
        log_event(sig_dir, event="sign", file="test.txt", hash="sha256:abc", identity="alice")
        log_event(sig_dir, event="verify", file="test.txt", hash="sha256:abc")

        entries = read_audit_log(sig_dir)
        assert len(entries) == 2
        assert entries[0].event == "sign"
        assert entries[0].ts
        assert entries[1].event == "verify"

    def test_filters_by_file(self, tmp_path):
        sig_dir = str(tmp_path)
        log_event(sig_dir, event="sign", file="a.txt")
        log_event(sig_dir, event="sign", file="b.txt")

        entries = read_audit_log(sig_dir, "a.txt")
        assert len(entries) == 1
        assert entries[0].file == "a.txt"

    def test_empty_log(self, tmp_path):
        entries = read_audit_log(str(tmp_path))
        assert len(entries) == 0
