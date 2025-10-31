import mongoose, { Schema, Document } from "mongoose";

/* =========================
   ENUMS / TYPE DEFINITIONS
========================= */
export type StaffRole = "Director" | "Manager" | "Sale-Staff" | "Security" | "Packer";
export type RelationshipStatus = "single" | "married" | "divorced" | "widowed" | "complicated";
export type Religion = "Catholic" | "Buddhist" | "Muslim" | "No Religion" | "Other";

export interface SalaryRecord {
  time: string; // YYYY-MM
  baseSalary: number;
  totalCloseOrder: number;
  totalDistributionOrder: number;
  totalDeliverySuccess?: number;
  totalDeliveryReturned?: number;
  totalRevenue: number;
  isPaid?: boolean;
  fine: {
    note: string;
    value: number;
  };
  bonus: {
    note: string;
    value: number;
  };
  overtime: {
    totalTime: number;
    value: number;
    note: string;
  };
  attendance: EmployeeAttendanceType[];

  dailyRecords: DailyRecordType[];
}

export interface EmployeeAttendanceType {
  date: string;
  checked: "onTime" | "late" | "absent";
  note?: string;
}

export interface StaffInfoType {
  name: string;
  birthday: string; // ISO date
  address: string;
  phone: string;
  relationshipStatus: RelationshipStatus;
  religion: Religion;
  description: string;
  identityId: string;
  accountLogin: string;
}
export interface DailyRecordType {
  date: string;
  bonus: number;
  bonusNote: string;
  fine: number;
  fineNote: string;
  overtime: number;
  overtimeNote: string;
}
/* =========================
   STAFF DOCUMENT INTERFACE
========================= */
export interface IStaff extends Document {
  userId: mongoose.Types.ObjectId; // 🔑 link to User
  role: StaffRole;
  salary: number;
  joinedDate: string;
  quitDate?: string;
  staffID: string;
  isOnline: boolean;
  lastSeen: string;
  claimedAt: string;
  isMorningBatch: boolean;

  staffInfo: StaffInfoType;

  diligenceCount: number;

  bankInfos: {
    bankAccountNumber: string;
    bankOwnerName: string;
    bankName: string;
    bankShortName: string;
    bankCode: string;
  };

  salaryHistory: SalaryRecord[];

  attendance: EmployeeAttendanceType[];

  dailyRecords?: DailyRecordType[];
}

/* =========================
   SCHEMAS
========================= */

const AttendanceSchema = new Schema<EmployeeAttendanceType>(
  {
    date: { type: String, required: true },
    checked: { type: String, enum: ["onTime", "late", "absent"], required: true },
    note: String,
  },
  { _id: false }
);

const DailyRecordSchema = new Schema<DailyRecordType>(
  { date: { type: String, required: true }, bonus: Number, bonusNote: String, fine: Number, fineNote: String, overtime: Number, overtimeNote: String },
  { _id: false }
);

const SalaryRecordSchema = new Schema<SalaryRecord>(
  {
    time: { type: String, required: true },
    baseSalary: { type: Number, required: true },
    totalCloseOrder: { type: Number, required: true },
    totalDistributionOrder: { type: Number, required: true },
    totalDeliverySuccess: Number,
    totalDeliveryReturned: Number,
    totalRevenue: { type: Number, required: true },
    isPaid: Boolean,
    fine: {
      note: String,
      value: Number,
    },
    bonus: {
      note: String,
      value: Number,
    },
    overtime: {
      totalTime: Number,
      value: Number,
      note: String,
    },

    attendance: { type: [AttendanceSchema], default: [] },

    dailyRecords: { type: [DailyRecordSchema], default: [] },
  },
  { _id: false }
);
const StaffInfoSchema = new Schema<StaffInfoType>(
  {
    name: { type: String },
    birthday: { type: String },
    address: { type: String },
    phone: { type: String },
    relationshipStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed", "complicated"],
      required: true,
    },
    religion: {
      type: String,
      enum: ["Catholic", "Buddhist", "Muslim", "No Religion", "Other"],
      required: true,
    },
    description: { type: String },
    identityId: { type: String },
    accountLogin: { type: String },
  },
  { _id: false }
);

const StaffSchema = new Schema<IStaff>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // 🔑 NEW FIELD
    role: {
      type: String,
      enum: ["Director", "Manager", "Sale-Staff", "Security", "Packer"],
      required: true,
    },
    staffID: String,
    salary: { type: Number, required: true },
    joinedDate: { type: String, required: true },
    quitDate: String,
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: String },
    claimedAt: { type: String, default: null },
    isMorningBatch: { type: Boolean, default: false },
    staffInfo: { type: StaffInfoSchema, required: true },

    diligenceCount: { type: Number, default: 0 },

    bankInfos: {
      bankAccountNumber: { type: String, default: "" },
      bankOwnerName: { type: String, default: "" },
      bankName: { type: String, default: "" },
      bankShortName: { type: String, default: "" },
      bankCode: { type: String, default: "" },
    },

    salaryHistory: { type: [SalaryRecordSchema], default: [] },

    attendance: { type: [AttendanceSchema], default: [] },

    dailyRecords: { type: [DailyRecordSchema], default: [] },
  },
  {
    timestamps: true,
    // collection: "staffs"
  }
);

export default mongoose.model<IStaff>("Staff", StaffSchema, "staffs");
