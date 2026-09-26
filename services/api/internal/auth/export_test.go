package auth

import "time"

// SetNow replaces the key set clock in tests.
func SetNow(k *KeySet, now func() time.Time) { k.now = now }
