const express = require("express");
const bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.json());
app.set("port", process.env.PORT || 3001);

// Express only serves static assets in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("client/build"));
}

const currentGame = {};

app.get("/api/bootstrap/currentGame", (req, res) => {
  res.json(currentGame);
});
app.post("/api/bootstrap/startGame", (req, res) => {
  currentGame.offer = req.body;
  currentGame.answer = undefined;
  res.json({});
});
app.post("/api/bootstrap/joinGame", (req, res) => {
  currentGame.answer = req.body;
  res.json({});
});

app.listen(app.get("port"), () => {
  console.log(`Find the server at: http://localhost:${app.get("port")}/`);
});
