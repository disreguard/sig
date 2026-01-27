from sig.core.store import store_sig, load_sig, load_signed_content, delete_sig, list_sigs
from sig.types import Signature


def _make_sig(file: str) -> Signature:
    return Signature(
        file=file,
        hash="sha256:abc123",
        algorithm="sha256",
        signed_by="tester",
        signed_at="2026-01-26T00:00:00Z",
        content_length=100,
    )


class TestStore:
    def test_stores_and_loads_signature(self, tmp_path):
        sig_dir = str(tmp_path)
        (tmp_path / "sigs").mkdir()
        sig = _make_sig("prompts/test.txt")
        store_sig(sig_dir, sig, "test content")

        result = load_sig(sig_dir, "prompts/test.txt")
        assert result.signature is not None
        assert result.signature.file == sig.file
        assert result.signature.hash == sig.hash
        assert result.signature.signed_by == sig.signed_by
        assert result.error is None

    def test_stores_and_loads_content(self, tmp_path):
        sig_dir = str(tmp_path)
        (tmp_path / "sigs").mkdir()
        sig = _make_sig("prompts/test.txt")
        store_sig(sig_dir, sig, "the signed content")

        content = load_signed_content(sig_dir, "prompts/test.txt")
        assert content == "the signed content"

    def test_not_found(self, tmp_path):
        sig_dir = str(tmp_path)
        (tmp_path / "sigs").mkdir()
        result = load_sig(sig_dir, "nonexistent.txt")
        assert result.signature is None
        assert result.error == "not-found"

    def test_corrupted(self, tmp_path):
        sig_dir = str(tmp_path)
        sigs_dir = tmp_path / "sigs"
        sigs_dir.mkdir()
        sig_path = sigs_dir / "bad.txt.sig.json"
        sig_path.write_text("NOT VALID JSON{{{", encoding="utf-8")

        result = load_sig(sig_dir, "bad.txt")
        assert result.signature is None
        assert result.error == "corrupted"

    def test_delete(self, tmp_path):
        sig_dir = str(tmp_path)
        (tmp_path / "sigs").mkdir()
        sig = _make_sig("prompts/test.txt")
        store_sig(sig_dir, sig, "content")
        delete_sig(sig_dir, "prompts/test.txt")

        result = load_sig(sig_dir, "prompts/test.txt")
        assert result.signature is None

        content = load_signed_content(sig_dir, "prompts/test.txt")
        assert content is None

    def test_list_all(self, tmp_path):
        sig_dir = str(tmp_path)
        (tmp_path / "sigs").mkdir()
        store_sig(sig_dir, _make_sig("a.txt"), "a")
        store_sig(sig_dir, _make_sig("dir/b.txt"), "b")

        sigs = list_sigs(sig_dir)
        assert len(sigs) == 2
        files = sorted(s.file for s in sigs)
        assert files == ["a.txt", "dir/b.txt"]

    def test_empty_list(self, tmp_path):
        sigs = list_sigs(str(tmp_path))
        assert len(sigs) == 0
