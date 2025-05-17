const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: String,
  address: String,
  photos: {
    type: [String],
    validate: {
      validator: v => v.length <= 10,
      message: 'Maximum 10 photos allowed!'
    }
  },
  description: String,
  perks: [String],
  extraInfo: String,
  checkIn: {
    type: Number,
    min: [0, 'Check-in time cannot be negative'],
    max: [23, 'Check-in time must be < 24']
  },
  checkOut: Number,
  maxGuests: Number,
  price: {
    type: Number,
    required: true,
    min: [1, 'Price must be at least $1']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  rentalAgreementPDF: String,

});


placeSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await Booking.deleteMany({ place: doc._id });
  }
});

const PlaceModel = mongoose.model('Place', placeSchema);

module.exports = PlaceModel;
