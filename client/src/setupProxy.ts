const proxy = require("http-proxy-middleware");

module.exports = (app) => {
  app.use(
    proxy("/api/peers/peerjs", {
      target: "http://localhost:3001",
      ws: true,
    }),
  );
  app.use(
    proxy("/api", {
      target: "http://localhost:3001",
    }),
  );
};
