# Security Spec for KryptoAnon

## 1. Data Invariants
- A message cannot be created outside of a valid room.
- A user can only post messages to a room if they have the room hash (implied by path access).
- `senderId` in the message payload must match the cryptographic hash of the public key or a consistent user ID.
- Message content has a strict size limit.
- `timestamp` must be the server time.
- Rooms are ephemeral (conceptually, rules should enforce recent activity if possible, otherwise we rely on server cleanup).

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a message with a `senderId` that doesn't match the current user ID.
2. **Ghost Field Injection**: Adding an `isAdmin: true` field to a message or room.
3. **ID Poisoning**: Using a 2KB string as `roomId` to trigger resource exhaustion.
4. **Time Warp**: Providing a client-side `timestamp` from the future/past.
5. **Orphaned Message**: Attempting to write to `/rooms/NON_EXISTENT/messages/msg1`.
6. **Unauthorized Read**: Attempting to read `/rooms/SECRET_ROOM` without knowing the hash (though Firestore requires document ID knowledge).
7. **Recursive List Scrape**: Attempting to list all rooms.
8. **Malicious Content Type**: Sending a message with `type: 'malware'`.
9. **Large Content Attack**: Sending a 2MB message content.
10. **State Mutation**: Attempting to update a message after it's been sent (Messages should be immutable).
11. **Room Hijack**: Attempting to update the `createdAt` of a room.
12. **Metadata Injection**: Trying to re-add metadata fields to a "cleaned" image payload.

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would verify that these payloads fail.

```typescript
// Example test cases
test('User cannot spoof senderId', async () => {
  const db = authedApp({ uid: 'user1' });
  await assertFails(db.doc('rooms/room1/messages/m1').set({
    senderId: 'user2', // Spoof
    senderAlias: 'Alice',
    content: '...',
    type: 'text',
    timestamp: serverTimestamp()
  }));
});
```
