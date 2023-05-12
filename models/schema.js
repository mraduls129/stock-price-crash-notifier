const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  entryDate: {
    type: Date,
    default: Date.now(),
  },
});

const User = mongoose.model('user', userSchema);

module.exports = User;