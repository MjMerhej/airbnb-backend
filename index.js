const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');
const mime = require('mime-types');
 
 
require('dotenv').config();


const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'fasefraw4r5r3wq45wdfgw34twdfg';


const app = express();
app.use(cookieParser());

app.use('/uploads', express.static(__dirname + '/uploads'));

app.use(cors({
  credentials: true,
  origin: 'http://ec2-13-53-64-182.eu-north-1.compute.amazonaws.com',
}));
 
app.use(express.json());


function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}


app.get('/test', (req, res) => {
  res.json('okay');
});

app.get('/', (req, res) => {
  res.json('hello from backend');
});




app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }

});

app.post('/login', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);

  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign({
        email: userDoc.email,
        id: userDoc._id
      }, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json(userDoc);
      });
    } else {
      res.status(422).json('pass not ok');
    }
  } else {
    res.json('not found');
  }
});

app.get('/profile', (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json(true);
});

app.post('/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await imageDownloader.image({
    url: link,
    dest: __dirname + '/uploads/' + newName,
  });
  res.json(newName)
});

const photosMiddleware = multer({ dest: __dirname + '/uploads/' });
app.post('/upload', photosMiddleware.array('photos', 100), async (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
    const filename = newPath.split('/').pop(); // Or use path.basename(newPath)
    uploadedFiles.push(filename);

  }
  res.json(uploadedFiles);
});

app.post('/places', (req, res) => {
  const { token } = req.cookies;
  const {
    title, address, addedPhotos, description, price,
    perks, extraInfo, checkIn, checkOut, maxGuests,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.create({
      owner: userData.id, price,
      title, address, photos: addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests,
      rentalAgreementPDF: req.body.rentalAgreementPDF

    });
    res.json(placeDoc);
  });
});

app.get('/user-places', (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });

});

app.get('/places/:id', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put('/places', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const {
    id, title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title, address, photos: addedPhotos, description,
        perks, extraInfo, checkIn, checkOut, maxGuests, price,
        rentalAgreementPDF: req.body.rentalAgreementPDF
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});

app.get('/places', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  res.json(await Place.find());
});

app.post('/bookings', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  const {
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
  } = req.body;
  Booking.create({
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
    user: userData.id,
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  });
});



app.get('/bookings', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate('place'));
});

const path = require('path');

// Fix multer configuration
const uploadPDF = multer({
  dest: path.join(__dirname, 'uploads'), // Use absolute path
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed!'), false);
    }
  }
});

// Update PDF upload endpoint
app.post('/upload-pdf', uploadPDF.single('pdf'), (req, res) => {
  const { path: tempPath, originalname } = req.file;
  const ext = path.extname(originalname);
  const newPath = tempPath + ext;
  fs.renameSync(tempPath, newPath);

  // PROPER filename extraction
  const filename = path.basename(newPath);
  res.json(filename);
});


app.delete('/places/:id', async (req, res) => {
  const { id } = req.params;
  await Place.findByIdAndDelete(id);
  res.json('Deleted');
});



// Places with WiFi + Pool + price <= 200
app.get('/places-with-perks', async (req, res) => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    const places = await Place.find({
      $and: [
        { perks: 'wifi' },
        { perks: 'tv' },

      ]
    });
    res.json(places);
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Average price 
app.get('/average-price', async (req, res) => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    const result = await Place.aggregate([
      { $group: { _id: null, avgPrice: { $avg: "$price" } } }
    ]);
    res.json(result[0]?.avgPrice || 0);
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});



app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Handle validation errors
  if (err.name === 'ValidationError') {
    const errors = {};
    Object.keys(err.errors).forEach(key => {
      errors[key] = err.errors[key].message;
    });
    return res.status(400).json({ errors });
  }

  // Handle other errors
  res.status(500).json({
    error: 'Something went wrong. Please try again later.'
  });
});


// popular places
app.get('/popular-places', async (req, res) => {
  try {
    const popularPlaces = await Place.aggregate([
      {
        $match: {
          $and: [
            { perks: { $all: ["wifi", "pets"] } },
            { price: { $gte: 50, $lte: 150 } },
            { $expr: { $gte: [{ $size: "$photos" }, 3] } }
          ]
        }
      },
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "place",
          as: "bookings"
        }
      },
      {
        $addFields: {
          bookingsCount: { $size: "$bookings" }
        }
      },
      {
        $match: {
          bookingsCount: { $gte: 4 }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails"
        }
      },
      {
        $project: {
          title: 1,
          price: 1,
          photos: 1,
          bookingsCount: 1,
          owner: { $arrayElemAt: ["$ownerDetails", 0] }
        }
      },
      { $sort: { bookingsCount: -1 } },
      { $limit: 10 }
    ]);

    res.json(popularPlaces);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Most booked places this month
app.get('/most-booked-this-month', async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await Booking.aggregate([
      {
        $match: {
          checkIn: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: "$place",
          bookingsCount: { $sum: 1 }
        }
      },
      {
        $sort: { bookingsCount: -1 }
      },
      {
        $limit: 6
      },
      {
        $lookup: {
          from: "places",
          localField: "_id",
          foreignField: "_id",
          as: "placeDetails"
        }
      },
      {
        $unwind: "$placeDetails"
      },
      {
        $lookup: {
          from: "users",
          localField: "placeDetails.owner",
          foreignField: "_id",
          as: "ownerDetails"
        }
      },
      {
        $project: {
          title: "$placeDetails.title",
          price: "$placeDetails.price",
          photos: "$placeDetails.photos",
          bookingsCount: 1,
          owner: { $arrayElemAt: ["$ownerDetails", 0] }
        }
      }
    ]);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Most Active Hosts
app.get('/most-active-hosts', async (req, res) => {
  try {
    const result = await User.aggregate([
      {
        $lookup: {
          from: "places",
          localField: "_id",
          foreignField: "owner",
          as: "listings"
        }
      },
      {
        $lookup: {
          from: "bookings",
          localField: "listings._id",
          foreignField: "place",
          as: "allBookings"
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          listingsCount: { $size: "$listings" },
          bookingsCount: { $size: "$allBookings" },
          activityScore: {
            $add: [
              { $multiply: [{ $size: "$listings" }, 2] },
              { $size: "$allBookings" }
            ]
          }
        }
      },
      {
        $match: {
          $or: [
            { listingsCount: { $gt: 0 } },
            { bookingsCount: { $gt: 0 } }
          ]
        }
      },
      {
        $sort: { activityScore: -1 }
      },
      {
        $limit: 5
      }
    ]);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(4000, () => {
  console.log('Server is running on http://localhost:4000');
});