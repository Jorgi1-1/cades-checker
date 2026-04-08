export type Role = "diri" | "coordi" | "asesor";

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
    lateMode?: boolean; // If true, new scans are marked as "late"
    type: "asamblea" | "junta"; // Type of event
}

export interface AttendanceRecord {
    id: string; // Document ID
    userId: string;
    eventId: string;
    timestamp: number; // When they were scanned
    scannedBy: string; // Coordinator ID who scanned
    status?: "present" | "late" | "excused"; // Status of attendance. Undefined = present (legacy)
}

