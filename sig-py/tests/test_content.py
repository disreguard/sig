"""Tests for content signing API."""

import re

import pytest

from sig.core.content import sign_content, verify_content, ContentStore, create_content_store
from sig.types import SignContentOptions, ContentSignature


class TestSignContent:
    def test_creates_signature_for_content(self):
        sig = sign_content("Hello world", SignContentOptions(id="msg_1", identity="alice"))

        assert sig.id == "msg_1"
        assert re.match(r"^sha256:[a-f0-9]{64}$", sig.hash)
        assert sig.algorithm == "sha256"
        assert sig.signed_by == "alice"
        assert sig.signed_at
        assert sig.content_length == len("Hello world".encode("utf-8"))

    def test_includes_metadata_in_signature(self):
        sig = sign_content(
            "Test message",
            SignContentOptions(
                id="msg_2",
                identity="owner:+1234567890:whatsapp",
                metadata={"channel": "whatsapp", "timestamp": "2025-01-29T12:00:00Z"},
            ),
        )

        assert sig.metadata == {"channel": "whatsapp", "timestamp": "2025-01-29T12:00:00Z"}

    def test_produces_deterministic_hash_for_same_content(self):
        sig1 = sign_content("Same content", SignContentOptions(id="a", identity="alice"))
        sig2 = sign_content("Same content", SignContentOptions(id="b", identity="bob"))

        assert sig1.hash == sig2.hash

    def test_produces_different_hash_for_different_content(self):
        sig1 = sign_content("Content A", SignContentOptions(id="a", identity="alice"))
        sig2 = sign_content("Content B", SignContentOptions(id="b", identity="alice"))

        assert sig1.hash != sig2.hash

    def test_uses_byte_length_for_non_ascii_content(self):
        content = "Hello 🌍"
        sig = sign_content(content, SignContentOptions(id="emoji", identity="alice"))

        # '🌍' is 4 bytes in UTF-8
        assert sig.content_length == len(content.encode("utf-8"))
        assert sig.content_length > len(content)


class TestVerifyContent:
    def setup_method(self):
        self.content = "Original message"
        self.signature = sign_content(self.content, SignContentOptions(id="msg", identity="alice"))

    def test_verifies_unmodified_content(self):
        result = verify_content(self.content, self.signature)
        assert result["verified"] is True
        assert "error" not in result

    def test_fails_verification_for_modified_content(self):
        result = verify_content("Modified message", self.signature)
        assert result["verified"] is False
        assert result["error"] == "Content hash mismatch"

    def test_fails_verification_for_empty_content_when_original_was_not_empty(self):
        result = verify_content("", self.signature)
        assert result["verified"] is False


class TestContentStore:
    def setup_method(self):
        self.store = ContentStore()

    class TestSign:
        def setup_method(self):
            self.store = ContentStore()

        def test_signs_and_stores_content(self):
            sig = self.store.sign("Test message", SignContentOptions(id="msg_1", identity="alice"))

            assert sig.id == "msg_1"
            assert self.store.has("msg_1") is True

        def test_overwrites_existing_signature_with_same_id(self):
            self.store.sign("First message", SignContentOptions(id="msg", identity="alice"))
            sig2 = self.store.sign("Second message", SignContentOptions(id="msg", identity="bob"))

            assert self.store.size == 1
            assert self.store.get("msg").signed_by == "bob"
            assert self.store.get("msg").hash == sig2.hash

    class TestVerify:
        def setup_method(self):
            self.store = ContentStore()

        def test_verifies_stored_content_by_id(self):
            self.store.sign(
                "Hello world",
                SignContentOptions(
                    id="msg_1",
                    identity="owner:+1234:whatsapp",
                    metadata={"channel": "whatsapp"},
                ),
            )

            result = self.store.verify("msg_1")

            assert result.verified is True
            assert result.id == "msg_1"
            assert result.content == "Hello world"
            assert result.signature.signed_by == "owner:+1234:whatsapp"
            assert result.signature.metadata["channel"] == "whatsapp"

        def test_fails_for_unknown_id(self):
            result = self.store.verify("unknown")

            assert result.verified is False
            assert result.error == "No signature found for id"

        def test_returns_full_provenance_info(self):
            self.store.sign(
                "Delete all files",
                SignContentOptions(
                    id="cmd_1",
                    identity="owner:+1234567890:whatsapp",
                    metadata={
                        "channel": "whatsapp",
                        "from": "+1234567890",
                        "timestamp": "2025-01-29T12:00:00Z",
                    },
                ),
            )

            result = self.store.verify("cmd_1")

            assert result.verified is True
            assert result.signature.metadata == {
                "channel": "whatsapp",
                "from": "+1234567890",
                "timestamp": "2025-01-29T12:00:00Z",
            }

    class TestList:
        def setup_method(self):
            self.store = ContentStore()

        def test_returns_empty_list_for_empty_store(self):
            assert self.store.list() == []

        def test_returns_all_signatures(self):
            self.store.sign("Message 1", SignContentOptions(id="a", identity="alice"))
            self.store.sign("Message 2", SignContentOptions(id="b", identity="bob"))

            sigs = self.store.list()
            assert len(sigs) == 2
            assert sorted([s.id for s in sigs]) == ["a", "b"]

    class TestGet:
        def setup_method(self):
            self.store = ContentStore()

        def test_returns_signature_by_id(self):
            self.store.sign("Test", SignContentOptions(id="msg", identity="alice"))
            sig = self.store.get("msg")

            assert sig.id == "msg"
            assert sig.signed_by == "alice"

        def test_returns_none_for_unknown_id(self):
            assert self.store.get("unknown") is None

    class TestDelete:
        def setup_method(self):
            self.store = ContentStore()

        def test_removes_signature_and_returns_true(self):
            self.store.sign("Test", SignContentOptions(id="msg", identity="alice"))

            deleted = self.store.delete("msg")

            assert deleted is True
            assert self.store.has("msg") is False
            assert self.store.verify("msg").verified is False

        def test_returns_false_for_unknown_id(self):
            assert self.store.delete("unknown") is False

    class TestClear:
        def setup_method(self):
            self.store = ContentStore()

        def test_removes_all_signatures(self):
            self.store.sign("A", SignContentOptions(id="a", identity="alice"))
            self.store.sign("B", SignContentOptions(id="b", identity="bob"))

            self.store.clear()

            assert self.store.size == 0
            assert self.store.list() == []

    class TestHas:
        def setup_method(self):
            self.store = ContentStore()

        def test_returns_true_for_existing_id(self):
            self.store.sign("Test", SignContentOptions(id="msg", identity="alice"))
            assert self.store.has("msg") is True

        def test_returns_false_for_unknown_id(self):
            assert self.store.has("unknown") is False

    class TestSize:
        def setup_method(self):
            self.store = ContentStore()

        def test_returns_number_of_signatures(self):
            assert self.store.size == 0

            self.store.sign("A", SignContentOptions(id="a", identity="alice"))
            assert self.store.size == 1

            self.store.sign("B", SignContentOptions(id="b", identity="bob"))
            assert self.store.size == 2

            self.store.delete("a")
            assert self.store.size == 1


class TestCreateContentStore:
    def test_creates_new_content_store_instance(self):
        store = create_content_store()
        assert isinstance(store, ContentStore)
        assert store.size == 0

    def test_creates_independent_stores(self):
        store1 = create_content_store()
        store2 = create_content_store()

        store1.sign("Test", SignContentOptions(id="msg", identity="alice"))

        assert store1.has("msg") is True
        assert store2.has("msg") is False


class TestIntegration:
    def test_complete_workflow_for_message_verification(self):
        """Test the complete sign and verify round-trip workflow."""
        # Simulate orchestrator receiving authenticated message
        store = create_content_store()

        # 1. Owner sends message via WhatsApp (authenticated)
        message_content = "delete all my files"
        message_id = "msg_12345"

        # 2. Orchestrator signs the message with provenance
        sig = store.sign(
            message_content,
            SignContentOptions(
                id=message_id,
                identity="owner:+1234567890:whatsapp",
                metadata={
                    "channel": "whatsapp",
                    "from": "+1234567890",
                    "timestamp": "2025-01-29T12:00:00Z",
                },
            ),
        )

        assert sig.id == message_id

        # 3. LLM calls verify to check message provenance
        result = store.verify(message_id)

        assert result.verified is True
        assert result.content == message_content
        assert result.signature.signed_by == "owner:+1234567890:whatsapp"
        assert result.signature.metadata["channel"] == "whatsapp"

        # 4. Attacker cannot spoof - unknown messages fail verification
        attack_result = store.verify("fake_msg_id")
        assert attack_result.verified is False
