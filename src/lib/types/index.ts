export type Role = "joven" | "coordinador";

export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    role: Role;
    createdAt: number;
}

export interface SessionEvent {
    id: string; // Document ID
    date: number; // Timestamp
    createdBy: string; // Coordinator ID
}

export interface AttendanceRecord {
    id: string; // Document ID
    userId: string;
    eventId: string;
    timestamp: number; // When they were scanned
    scannedBy: string; // Coordinator ID who scanned
}
