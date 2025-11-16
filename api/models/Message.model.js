import mongoose from 'mongoose';

const FileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true }, // e.g. "/uploads/123-user-file.png"
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number }, // bytes
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '' },
    file: { type: FileSchema, default: null },
  },
  { timestamps: true }
);

const MessageModel = mongoose.model('Message', MessageSchema);

export default MessageModel;
