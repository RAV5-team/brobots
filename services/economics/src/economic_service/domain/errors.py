"""Domain errors raised by the economic service."""


class DomainError(ValueError):
    """Base class for expected domain validation failures."""


class InvalidInputError(DomainError):
    """Indicates that an input violates a domain invariant."""


class CurrencyMismatchError(DomainError):
    """Indicates that a calculation combines incompatible currencies."""


class UnsupportedCurrencyError(DomainError):
    """Indicates that a v1 calculation uses an unsupported currency."""


class ModelVersionError(DomainError):
    """Indicates that a requested calculation model is unavailable."""
