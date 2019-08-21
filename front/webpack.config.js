var webpack = require('webpack');

var config = {
  context: __dirname + '/js', // `__dirname` is root of project and `src` is source
  entry: {
    app: './main.js',
  },
  output: {
    path: __dirname + '/build/js', // `dist` is the destination
    publicPath: "/assets/",
    filename: 'main.js',
  },
};

module.exports = config;
