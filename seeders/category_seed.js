const seeder = require('mongoose-seed');
const dotenv = require('dotenv')

dotenv.config({ path: './config.env' })

const { DB } = require("../config");
// Connect to MongoDB via Mongoose
seeder.connect(DB, {useNewUrlParser: true, useUnifiedTopology: true}, function () {

  // Load Mongoose models
  seeder.loadModels([
    'models/Category.js',
  ]);

  // Clear specified collections
  seeder.clearModels(['Category'], function () {

    // Callback to populate DB once collections have been cleared
    seeder.populateModels(data, function () {
      seeder.disconnect();
    });

  });
});

// Data array containing seed data - documents organized by Model
var data = [
  {
    'model': 'Category',
    'documents': [
      {
        'category_name': 'Category 1',
        'officer_id:': 2001
      },
      {
        'category_name': 'Category 2',
        'officer_id:': 2002
      }
    ]
  }
];