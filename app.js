const path = require('path');
const express = require('express');

// Have Node serve the files for our built React app
app.use(express.static(path.resolve(__dirname, './client/build')));

const shipStationRoutes = require("./routes/shipstation");
const compression = require("compression");

const app = express();
app.use(compression());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use("/shipstation/", shipStationRoutes);

app.listen(process.env.PORT || 3001);
