const { createProxyMiddleware } = require("http-proxy-middleware");

/**
 * Dev-time proxy to avoid CORS errors when hitting the backend directly.
 */
module.exports = function (app) {
  app.use(
    "/v1",
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
    })
  );
};
