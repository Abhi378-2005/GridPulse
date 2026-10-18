import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── User Accounts ────────────────────────────────────────
export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  nodeId: Types.ObjectId | null;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    nodeId: { type: Schema.Types.ObjectId, ref: 'GridNode', default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
