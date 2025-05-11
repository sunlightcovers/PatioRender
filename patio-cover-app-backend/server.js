const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/upload-photos', upload.array('photos', 3), (req, res) => {
  setTimeout(() => {
    res.json({ modelUrl: '/dummy-house-model.gltf' });
    req.files.forEach((file) => {
      fs.unlinkSync(file.path);
    });
  }, 2000);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});