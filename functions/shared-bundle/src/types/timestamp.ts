/**
 * Platform-agnostic Timestamp type.
 * On the server (Cloud Functions), this maps to firestore.Timestamp.
 * On the client (React Native), this maps to FirebaseFirestoreTypes.Timestamp.
 * Both have { seconds: number, nanoseconds: number, toDate(): Date }.
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}
