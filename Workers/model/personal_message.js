const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const personalMessageSchema = new Schema({
    type: { type: String, enum: ['text','file','link','image','accept','end','ticket','tag'], default: 'text', required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, default: Date.now, required: true },
    status: { type: String, enum: ['pending','delivered','seen','discarded'], default: 'pending', required: true },
    message: String,
    data: String,
    content: Buffer,
    link: String,
    session: String,
    upload: String,
    from: { type: String, required: true },
    to: { type: String, required: true },
    direction: { type: String, enum: ['inbound','outbound'], default: 'inbound' },
    uuid: { type: String, required: true, unique: true },
    jti: String,
    agentId: String,
    agentName: String,
    channel: String,
    wa_id: String,
    externalUserId: String,
    company: String,
    tenant: String,
    BusinessUnit: String
});

module.exports = mongoose.model("PersonalMessage", personalMessageSchema);
