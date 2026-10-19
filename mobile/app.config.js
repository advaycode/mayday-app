// Everything lives in app.json. This file only adds the web base path for the
// iPhone build, which GitHub Pages serves under /mayday/ (tools/build_iphone.py
// sets MAYDAY_BASE_URL). The dev server and the phone mirror stay at /.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.MAYDAY_BASE_URL ? { baseUrl: process.env.MAYDAY_BASE_URL } : {}),
  },
});
