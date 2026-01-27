import hashlib


def sha256(content: str) -> str:
    """SHA-256 hash of UTF-8 encoded content, returns lowercase hex."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def format_hash(hex_str: str) -> str:
    return f"sha256:{hex_str}"


def parse_hash(hash_str: str) -> tuple[str, str]:
    """Returns (algorithm, hex). Defaults to sha256 if no prefix."""
    if ":" in hash_str:
        alg, hex_val = hash_str.split(":", 1)
        return alg, hex_val
    return "sha256", hash_str
