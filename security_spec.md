# Firestore Security Specification - Hoffad (Refined)

## Data Invariants
1. **User Ownership**: All core user data (`lessons`, `profile`) must be strictly accessible by the authenticated owner OR a verified linked TV device.
2. **Subscription-Gated AI Features**: Advanced features such as AI text extraction uploads require a verified active subscription (`subscription.status == 'active'`) in the user document `/users/{userId}`.
3. **TV Session Sovereignty**: Only the device that initiated the session (via `currentAnonUid`) or the phone scanning it should be able to update it. Status transitions must be strictly followed (`waiting` -> `linked`).
4. **Transient Upload Integrity**: Uploads are scoped to a user and a target TV. Verified via `userId` and `anonUid`.
5. **Denial of Wallet**: Every field must have strict type and size constraints. Document IDs must match standard regex.

## The "Dirty Dozen" Payloads (Red Team Tests)

### 1. Free-tier AI Remote Upload Bypass
- **Target**: `/uploads/AiUpload123` (Create)
- **Attacker**: User A (Without `subscription.status == 'active'` in `/users/UserA`)
- **Payload**: `{ "deviceId": "TV1", "anonUid": "Anon1", "type": "image", "url": "https://...", "createdAt": request.time, "userId": "UserA" }`
- **Result**: `PERMISSION_DENIED` (Strictly rejected by `hasActiveSubscription(request.auth.uid)`)

### 2. Identity Spoofing (Write to Others)
- **Target**: `/users/UserB`
- **Attacker**: User A
- **Payload**: `{ "xp": 999999 }`
- **Result**: `PERMISSION_DENIED`

### 2. Session Hijacking (Takeover waiting session)
- **Target**: `/tv_sessions/WaitingSessionID`
- **Attacker**: User B (not the scanner)
- **Payload**: `{ "status": "linked", "uid": "UserB_UID" }`
- **Result**: `PERMISSION_DENIED` (Must be the legitimate scanner)

### 3. State Shortcutting (Skip login)
- **Target**: `/tv_sessions` (Create)
- **Attacker**: Anonymous
- **Payload**: `{ "status": "linked", "uid": "VictimUID" }`
- **Result**: `PERMISSION_DENIED` (Status must initialize as `waiting` or `active`)

### 4. PII Leakage (Profile Scraping)
- **Target**: `/users/UserA` (Get)
- **Attacker**: Authenticated User B
- **Result**: `PERMISSION_DENIED` (Profile only readable by owner or linked session)

### 5. Shadow Update (Resource Poisoning)
- **Target**: `/users/UserA`
- **Attacker**: User A
- **Payload**: `{ "xp": 100, "is_admin": true }`
- **Result**: `PERMISSION_DENIED` (via `affectedKeys().hasOnly()`)

### 6. Orphaned Lesson Injection
- **Target**: `/users/UserA/lessons/MyLesson`
- **Attacker**: User B
- **Result**: `PERMISSION_DENIED`

### 7. Recursive Cost Attack (Large ID)
- **Target**: `/users/REALLY_LARGE_ID_STRING...`
- **Attacker**: Any
- **Result**: `PERMISSION_DENIED` (via `isValidId()`)

### 8. Timestamp Forgery
- **Target**: `/uploads/NewUpload`
- **Attacker**: User A
- **Payload**: `{ ..., "createdAt": "2099-01-01" }`
- **Result**: `PERMISSION_DENIED` (via `request.time` check)

### 9. Upload Scraping (Sensitive files)
- **Target**: `/uploads` (List)
- **Attacker**: Authenticated User B (Neither sender nor target)
- **Result**: `PERMISSION_DENIED`

### 10. Immutable Field Overwrite
- **Target**: `/users/UserA`
- **Attacker**: User A
- **Payload**: Attempt to change `createdAt`
- **Result**: `PERMISSION_DENIED`

### 11. Cross-Session Read
- **Target**: `/tv_sessions/Session_A`
- **Attacker**: TV_B (Anonymous)
- **Result**: `PERMISSION_DENIED` (Only scanner or session owner can read)

### 12. List Poisoning (Unbounded arrays) - App Design Check
- **Constraint**: App uses subcollections for lessons. Rules must prevent array usage for unbounded lists.

## Conflict Report
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| users | Protected via `isOwner` | Protected via `isValidProfile` | Protected via `hasOnly` |
| lessons | Protected via `isOwner` | N/A | Protected via `hasOnly` |
| tv_sessions | Protected via `canUpdateSession` | Protected via `status` check | Protected via `isValidTVSession` |
| uploads | Protected via `userId` | Protected via `status` | Protected via `isValidRemoteUpload` |
