-- Drop the player-login feature (PlayerCredential, PlayerInvite).
-- WebAuthnChallenge and PasskeyCredential are kept: admin passkey login.

DROP TABLE IF EXISTS "PlayerInvite";
DROP TABLE IF EXISTS "PlayerCredential";
