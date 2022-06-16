const fs = require('fs');
const parse = require('csv-parse').parse;
const os = require('os');
const multer  = require('multer');
const upload = multer({ dest: os.tmpdir() })

const express = require('express');
const bodyParser = require('body-parser');
const port = process.env.PORT || 3000;

const shipStationRoutes = require("./routes/shipstation");
const compression = require("compression");

const app = express();
app.use(compression());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(bodyParser.json());
app.use(express.static('public'));

app.use("/shipstation/", shipStationRoutes);

app.post('/read', upload.single('file'), (req, res) => {
    const file = req.file

    const processFile = async () => {
      const records = [];
      const parser = fs
        .createReadStream(file.path)
        .pipe(parse({
          from_line: 2, skip_empty_lines: true, trim: true, delimiter: '\t', columns: true
        }));
      for await (const record of parser) {
        // Work with each record
        records.push(record);
      }
      return records;
    };
    
    (async () => {
      const records = await processFile();
      try {
        let recordsJSON = JSON.stringify(records);
        fs.writeFileSync('upload/inventory.json', recordsJSON);
        // file written successfully
      } catch (err) {
        console.error(err);
      }
      // console.info(records);
    })();

    const data = fs.readFileSync(file.path)
    parse(data, (err, records) => {
      if (err) {
        console.error(err)
        return res.status(400).json({success: false, message: 'An error occurred'})
      }
      
      return res.json({data: records})
    }, {from_line: 2, skip_empty_lines: true, trim: true, delimiter: '\t'})
  });


app.listen(port, () => {
    console.log(`App listening on port ${port}`)
  });
