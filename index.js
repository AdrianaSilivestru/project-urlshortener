require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const dns = require("dns").promises;
const app = express();

const port = process.env.PORT || 3000;

app.use(cors());
app.use("/public", express.static(`${process.cwd()}/public`));

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});

const uri = process.env.MONGO_URI;
mongoose.connect(uri);

// schema
let urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
  },
  shortUrl: Number,
});

//model
let Url = mongoose.model("Url", urlSchema);

// Create post route
app.post(
  "/api/shorturl",
  bodyParser.urlencoded({ extended: false }),
  async (req, res) => {
    let inputUrl = req.body["url"];

    // Extract the hostname from the URL
    let url;
    try {
      url = new URL(inputUrl);
    } catch (e) {
      return res.json({ error: "Invalid URL" });
    }

    try {
      // Check if the URL is reachable
      await dns.lookup(url.hostname);

      let shortInput = 1;

      // Find the latest URL added in DB
      const lastUrl = await Url.findOne({}).sort({ shortUrl: "desc" }).exec();
      if (lastUrl) {
        shortInput = lastUrl.shortUrl + 1;
      }

      const savedUrl = await Url.findOneAndUpdate(
        { originalUrl: inputUrl },
        { originalUrl: inputUrl, shortUrl: shortInput },
        { new: true, upsert: true }
      );

      res.json({
        original_url: savedUrl.originalUrl,
        short_url: savedUrl.shortUrl,
      });
    } catch (err) {
      if (err.code === "ENOTFOUND") {
        return res.json({ error: "Invalid URL" });
      }
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Create get route
app.get("/api/shorturl/:input", async (req, res) => {
  let input = req.params.input;

  try {
    const result = await Url.findOne({ shortUrl: input }).exec();

    if (result) {
      res.redirect(result.originalUrl);
    } else {
      res.json({ error: "No short URL found for the given input" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
