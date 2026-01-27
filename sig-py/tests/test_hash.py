from sig.core.hash import sha256, format_hash, parse_hash


def test_sha256_produces_correct_hex():
    result = sha256("hello")
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)
    # Known SHA-256 of "hello"
    assert result == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"


def test_format_hash_prepends_prefix():
    assert format_hash("abc123") == "sha256:abc123"


def test_parse_hash_splits_correctly():
    alg, hex_val = parse_hash("sha256:abc123")
    assert alg == "sha256"
    assert hex_val == "abc123"

    alg2, hex_val2 = parse_hash("deadbeef")
    assert alg2 == "sha256"
    assert hex_val2 == "deadbeef"
