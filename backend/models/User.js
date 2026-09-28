const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pin: { type: String }, // For your 4-digit lock screen
    routines: { type: Object, default: {} },
    finances: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);